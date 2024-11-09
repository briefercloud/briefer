import {
  ExecutionQueueItem,
  ExecutionQueueItemVisualizationMetadata,
  VisualizationBlock,
  getVisualizationAttributes,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import {
  DataFrame,
  isInvalidVisualizationFilter,
  parseOrElse,
} from '@briefer/types'
import { createVisualization } from '../../../python/visualizations.js'
import { z } from 'zod'
import { EventContext, VisEvents } from '../../../events/index.js'
import { WSSharedDocV2 } from '../index.js'

export type VisualizationEffects = {
  createVisualization: typeof createVisualization
}

export interface IVisualizationExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationBlock>,
    metadata: ExecutionQueueItemVisualizationMetadata
  ): Promise<void>
}

export class VisualizationExecutor implements IVisualizationExecutor {
  private workspaceId: string
  private documentId: string
  private dataframes: Y.Map<DataFrame>
  private effects: VisualizationEffects
  private events: VisEvents

  constructor(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    effects: VisualizationEffects,
    events: VisEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataframes = dataframes
    this.effects = effects
    this.events = events
  }

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationBlock>,
    metadata: ExecutionQueueItemVisualizationMetadata
  ) {
    block.removeAttribute('result')
    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'running visualization block'
      )

      const {
        chartType,
        xAxis,
        xAxisName,
        xAxisGroupFunction,
        xAxisSort,
        yAxes,
        histogramBin,
        histogramFormat,
        showDataLabels,
        numberValuesFormat,
        filters,
        dataframeName,
      } = getVisualizationAttributes(block)
      if (!dataframeName) {
        executionItem.setError()
        return
      }
      const dataframe = this.dataframes.get(dataframeName)

      const hasAValidYAxis = yAxes.some((yAxis) =>
        yAxis.series.some((s) => s.column !== null)
      )

      if (
        !dataframe ||
        (!xAxis && chartType !== 'number' && chartType !== 'trend') ||
        (!hasAValidYAxis && chartType !== 'histogram')
      ) {
        return
      }

      const validFilters = filters.filter(
        (f) =>
          dataframe.columns.some((c) => c.name === f.column?.name) &&
          !isInvalidVisualizationFilter(f, dataframe)
      )

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      // TODO
      // this.events.visUpdate(EventContext.fromYTransaction(tr), chartType)
      const { promise, abort } = await this.effects.createVisualization(
        this.workspaceId,
        this.documentId,
        dataframe,
        chartType,
        xAxis,
        xAxisName,
        xAxisGroupFunction,
        xAxisSort,
        yAxes,
        histogramFormat,
        histogramBin,
        showDataLabels,
        numberValuesFormat,
        validFilters
      )

      if (aborted) {
        await abort()
      }

      let abortP = Promise.resolve(aborted)
      cleanup()
      cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          abortP = abort().then(() => true)
        }
      })

      const result = await promise
      aborted = await abortP
      cleanup()

      if (Object.keys(result.filterResults).length > 0) {
        const nextFilters = filters.map((f) => {
          const next = result.filterResults[f.id]
          if (next) {
            return next
          }

          return f
        })
        block.setAttribute('filters', nextFilters)
      }

      if (aborted) {
        executionItem.setAborted()
        block.setAttribute('spec', null)
        return
      }

      if (!result.success) {
        if (result.reason !== 'aborted') {
          executionItem.setAborted()
          block.setAttribute('error', result.reason)
        } else {
          executionItem.setError()
        }

        block.setAttribute('spec', null)
        return
      }

      block.setAttribute('spec', result.spec)
      const capped = parseOrElse(
        z.object({ usermeta: z.object({ capped: z.boolean() }) }),
        result.spec,
        { usermeta: { capped: false } }
      ).usermeta.capped
      block.setAttribute('tooManyDataPointsHidden', !capped)
      block.setAttribute('updatedAt', new Date().toISOString())
      block.setAttribute('error', null)
      executionItem.setSuccess()

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'visualization block run completed'
      )
    } catch (err) {
      logger().error({
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        err,
      })

      block.setAttribute('error', 'unknown')
      block.setAttribute('spec', null)
      executionItem.setError()
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2, events: VisEvents) {
    return new VisualizationExecutor(
      doc.workspaceId,
      doc.documentId,
      doc.dataframes,
      { createVisualization },
      events
    )
  }
}
