import { VisualizationBlock, getVisualizationAttributes } from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../../logger.js'
import {
  DataFrame,
  isInvalidVisualizationFilter,
  parseOrElse,
} from '@briefer/types'
import { createVisualization } from '../../../../python/visualizations.js'
import { z } from 'zod'
import { EventContext, VisEvents } from '../../../../events/index.js'

export type VisualizationEffects = {
  createVisualization: typeof createVisualization
}

type Running = {
  abortController: AbortController
  abort?: () => Promise<void>
}

export interface IVisualizationExecutor {
  isIdle(): boolean
  run(block: Y.XmlElement<VisualizationBlock>, tr: Y.Transaction): Promise<void>
  abort(block: Y.XmlElement<VisualizationBlock>): Promise<void>
}

export class VisualizationExecutor implements IVisualizationExecutor {
  private workspaceId: string
  private documentId: string
  private dataframes: Y.Map<DataFrame>
  private executionQueue: PQueue
  private running = new Map<Y.XmlElement<VisualizationBlock>, Set<Running>>()
  private effects: VisualizationEffects
  private events: VisEvents

  constructor(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    executionQueue: PQueue,
    effects: VisualizationEffects,
    events: VisEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataframes = dataframes
    this.executionQueue = executionQueue
    this.effects = effects
    this.events = events
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async abort(block: Y.XmlElement<VisualizationBlock>) {
    const run = this.running.get(block)
    if (!run) {
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'aborting visualization block run'
    )

    await Promise.all(
      Array.from(run).map(async (r) => {
        r.abortController.abort()

        await r.abort?.()
      })
    )

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'visualization block run aborted'
    )
  }

  public async run(block: Y.XmlElement<VisualizationBlock>, tr: Y.Transaction) {
    const abortController = new AbortController()
    const running: Running = { abortController }

    const runs = this.running.get(block) ?? new Set()
    runs.add(running)
    this.running.set(block, runs)

    block.removeAttribute('result')

    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          queueSize: this.executionQueue.size,
        },
        'enqueuing visualization block run'
      )

      await this.executionQueue.add(
        async ({ signal }) => {
          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
            },
            'running visualization block'
          )

          const dataframeName = block.getAttribute('dataframeName')
          if (!dataframeName) {
            return
          }

          const dataframe = this.dataframes.get(dataframeName)
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
          } = getVisualizationAttributes(block)

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

          this.events.visUpdate(EventContext.fromYTransaction(tr), chartType)
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

          running.abort = abort
          if (signal?.aborted) {
            await abort()
          }

          const result = await promise
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

          if (!result.success) {
            if (result.reason !== 'aborted') {
              block.setAttribute('error', result.reason)
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

          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
            },
            'visualization block run completed'
          )
        },
        { signal: abortController.signal }
      )
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        block.setAttribute('spec', null)
        return
      }

      block.setAttribute('error', 'unknown')
      block.setAttribute('spec', null)
      throw e
    } finally {
      runs.delete(running)
      if (runs.size === 0) {
        this.running.delete(block)
      }
    }
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    executionQueue: PQueue,
    events: VisEvents
  ) {
    return new VisualizationExecutor(
      workspaceId,
      documentId,
      dataframes,
      executionQueue,
      { createVisualization },
      events
    )
  }
}
