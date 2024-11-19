import {
  ExecutionQueueItem,
  ExecutionQueueItemPivotTableLoadPageMetadata,
  ExecutionQueueItemPivotTableMetadata,
  PivotTableBlock,
  YBlock,
  getPivotTableAttributes,
} from '@briefer/editor'
import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import { DataFrame } from '@briefer/types'
import { createPivotTable } from '../../../python/pivot-table.js'
import { WSSharedDocV2 } from '../index.js'

export type PivotTableEffects = {
  createPivotTable: typeof createPivotTable
}

export interface IPivotTableExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PivotTableBlock>,
    metadata: ExecutionQueueItemPivotTableMetadata
  ): Promise<void>
  loadPage(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PivotTableBlock>,
    metadata: ExecutionQueueItemPivotTableLoadPageMetadata
  ): Promise<void>
}

export class PivotTableExecutor implements IPivotTableExecutor {
  private workspaceId: string
  private documentId: string
  private dataframes: Y.Map<DataFrame>
  private blocks: Y.Map<YBlock>
  private effects: PivotTableEffects

  constructor(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    effects: PivotTableEffects
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataframes = dataframes
    this.blocks = blocks
    this.effects = effects
  }

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PivotTableBlock>,
    _metadata: ExecutionQueueItemPivotTableMetadata
  ) {
    return this._run(executionItem, block, 'create')
  }

  public async loadPage(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PivotTableBlock>,
    _metadata: ExecutionQueueItemPivotTableLoadPageMetadata
  ) {
    return this._run(executionItem, block, 'read')
  }

  private async _run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PivotTableBlock>,
    operation: 'create' | 'read'
  ) {
    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'running pivot table block'
      )

      const dataframeName = block.getAttribute('dataframeName')
      if (!dataframeName) {
        executionItem.setCompleted('error')
        return
      }

      const dataframe = this.dataframes.get(dataframeName)
      if (!dataframe) {
        executionItem.setCompleted('error')
        return
      }

      const attrs = getPivotTableAttributes(block, this.blocks)

      if (operation === 'create') {
        const rows = attrs.rows
          .map((row) => row.column)
          .filter((row) => row !== null)
        const cols = attrs.columns
          .map((col) => col.column)
          .filter((col) => col !== null)
        const metrics = attrs.metrics
          .map((metric) => metric.column)
          .filter((metric) => metric !== null)

        if (rows.length === 0 || cols.length === 0 || metrics.length === 0) {
          block.setAttribute('updatedAt', new Date().toISOString())
          block.setAttribute('error', null)
          executionItem.setCompleted('success')
          return
        }

        const all = [...rows, ...cols, ...metrics]

        for (const column of all) {
          if (
            column &&
            dataframe.columns.findIndex(
              (c) => c.name.toString() === column.name.toString()
            ) === -1
          ) {
            block.setAttribute('updatedAt', new Date().toISOString())
            block.setAttribute('error', null)
            executionItem.setCompleted('success')
            return
          }
        }
      }

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })
      const { promise, abort } = await this.effects.createPivotTable(
        this.workspaceId,
        this.documentId,
        dataframe,
        attrs.rows,
        attrs.columns,
        attrs.metrics,
        attrs.sort,
        attrs.variable.value,
        attrs.page,
        operation
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

      if (aborted) {
        executionItem.setCompleted('aborted')
        return
      }

      if (!result.success) {
        if (result.reason !== 'aborted') {
          block.setAttribute('error', result.reason)
        }
        executionItem.setCompleted(
          result.reason === 'aborted' ? 'aborted' : 'error'
        )
      } else {
        block.setAttribute('updatedAt', new Date().toISOString())
        block.setAttribute('error', null)
        block.setAttribute('result', result.result)
        block.setAttribute('page', result.result.page)
        executionItem.setCompleted('success')
      }

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'pivot table block run completed'
      )
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Failed to run pivot table block'
      )

      block.setAttribute('error', 'unknown')
      executionItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new PivotTableExecutor(
      doc.workspaceId,
      doc.documentId,
      doc.dataframes,
      doc.blocks,
      { createPivotTable }
    )
  }
}
