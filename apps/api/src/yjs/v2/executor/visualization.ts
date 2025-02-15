import {
  ExecutionQueueItem,
  ExecutionQueueItemVisualizationMetadata,
  ExecutionQueueItemVisualizationV2Metadata,
  VisualizationBlock,
  getVisualizationAttributes,
  getVisualizationV2Attributes,
  VisualizationV2Block,
  setVisualizationV2Input,
} from '@briefer/editor'
import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import {
  DataFrame,
  isInvalidVisualizationFilter,
  parseOrElse,
} from '@briefer/types'
import { createVisualization } from '../../../python/visualizations.js'
import { createVisualizationV2 } from '../../../python/visualizations-v2.js'
import { z } from 'zod'
import { VisEvents } from '../../../events/index.js'
import { WSSharedDocV2 } from '../index.js'
import { advanceTutorial } from '../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../websocket/workspace/tutorial.js'
import { getJupyterManager } from '../../../jupyter/index.js'
import { executeCode } from '../../../python/index.js'

export type VisualizationEffects = {
  createVisualization: typeof createVisualization
  createVisualizationV2: typeof createVisualizationV2
  advanceTutorial: typeof advanceTutorial
  broadcastTutorialStepStates: (
    workspaceId: string,
    tutorialType: 'onboarding'
  ) => Promise<void>
}

export interface IVisualizationExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationBlock>,
    metadata: ExecutionQueueItemVisualizationMetadata,
    events: VisEvents
  ): Promise<void>
  runV2(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationV2Block>,
    metadata: ExecutionQueueItemVisualizationV2Metadata,
    events: VisEvents
  ): Promise<void>
}

export class VisualizationExecutor implements IVisualizationExecutor {
  constructor(
    private readonly sessionId: string,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly dataframes: Y.Map<DataFrame>,
    private readonly effects: VisualizationEffects
  ) {}

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationBlock>,
    _metadata: ExecutionQueueItemVisualizationMetadata,
    events: VisEvents
  ) {
    block.removeAttribute('result')
    try {
      logger().trace(
        {
          sessionId: this.sessionId,
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
        executionItem.setCompleted('error')
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
        executionItem.setCompleted('error')
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

      events.visUpdate(chartType)
      const { promise, abort } = await this.effects.createVisualization(
        this.workspaceId,
        this.sessionId,
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
        executionItem.setCompleted('aborted')
        block.setAttribute('spec', null)
        return
      }

      if (!result.success) {
        if (result.reason === 'aborted') {
          executionItem.setCompleted('aborted')
        } else {
          block.setAttribute('error', result.reason)
          executionItem.setCompleted('error')
        }

        block.setAttribute('spec', null)
        return
      }

      block.setAttribute('spec', result.spec)
      block.setAttribute('xAxisTimezone', result.xAxisTimezone)
      const capped = parseOrElse(
        z.object({ usermeta: z.object({ capped: z.boolean() }) }),
        result.spec,
        { usermeta: { capped: false } }
      ).usermeta.capped
      block.setAttribute('tooManyDataPointsHidden', !capped)
      block.setAttribute('updatedAt', new Date().toISOString())
      block.setAttribute('error', null)
      executionItem.setCompleted('success')

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'visualization block run completed'
      )

      const tutorialState = await this.effects.advanceTutorial(
        this.workspaceId,
        'onboarding',
        'createVisualization'
      )
      this.effects.broadcastTutorialStepStates(this.workspaceId, 'onboarding')
      if (tutorialState.didAdvance) {
        events.advanceOnboarding('createVisualization')
      }
    } catch (err) {
      logger().error(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Failed to run visualization block'
      )

      block.setAttribute('error', 'unknown')
      block.setAttribute('spec', null)
      executionItem.setCompleted('error')
    }
  }

  public async runV2(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<VisualizationV2Block>,
    _metadata: ExecutionQueueItemVisualizationV2Metadata,
    events: VisEvents
  ) {
    try {
      logger().trace(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'running visualization v2 block'
      )

      const attrs = getVisualizationV2Attributes(block)
      if (!attrs.input.dataframeName) {
        block.setAttribute('output', null)
        block.setAttribute('error', 'dataframe-not-set')
        executionItem.setCompleted('error')
        return
      }

      const dataframe = this.dataframes.get(attrs.input.dataframeName)
      if (!dataframe) {
        block.setAttribute('output', null)
        block.setAttribute('error', 'dataframe-not-found')
        executionItem.setCompleted('error')
        return
      }

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      events.visUpdate(attrs.input.chartType)
      const { promise, abort } = await this.effects.createVisualizationV2(
        this.workspaceId,
        this.sessionId,
        dataframe,
        attrs.input,
        getJupyterManager(),
        executeCode
      )

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

      if (aborted) {
        executionItem.setCompleted('aborted')
        return
      }

      if (result.success) {
        const output = {
          executedAt: new Date().toISOString(),
          result: result.data,
          tooManyDataPoints: result.tooManyDataPoints,
        }
        block.setAttribute('output', output)
        block.setAttribute('error', null)
        const filters = attrs.input.filters.map((f) => {
          const resultFilter = result.filters.find((rf) => rf.id === f.id)
          if (resultFilter) {
            return resultFilter
          }

          return f
        })

        setVisualizationV2Input(block, { filters })
        executionItem.setCompleted('success')
      } else {
        if (result.reason === 'aborted') {
          executionItem.setCompleted('aborted')
        } else {
          block.setAttribute('output', null)
          block.setAttribute('error', result.reason)
          executionItem.setCompleted('error')
        }
      }
    } catch (err) {
      logger().error(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Failed to run visualization v2 block'
      )

      block.setAttribute('output', null)
      block.setAttribute('error', 'unknown')
      executionItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new VisualizationExecutor(
      doc.id,
      doc.workspaceId,
      doc.documentId,
      doc.dataframes,
      {
        createVisualization,
        createVisualizationV2,
        advanceTutorial,
        broadcastTutorialStepStates: (
          workspaceId: string,
          tutorialType: 'onboarding'
        ) => {
          return broadcastTutorialStepStates(
            doc.socketServer,
            workspaceId,
            tutorialType
          )
        },
      }
    )
  }
}
