import {
  PivotTableBlock,
  YBlock,
  getPivotTableAttributes,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../../logger.js'
import { DataFrame } from '@briefer/types'
import { createPivotTable } from '../../../../python/pivot-table.js'

export type PivotTableEffects = {
  createPivotTable: typeof createPivotTable
}

type Running = {
  abortController: AbortController
  abort?: () => Promise<void>
}

export interface IPivotTableExecutor {
  isIdle(): boolean
  run(block: Y.XmlElement<PivotTableBlock>, tr: Y.Transaction): Promise<void>
  loadPage(
    block: Y.XmlElement<PivotTableBlock>,
    tr: Y.Transaction
  ): Promise<void>
  abort(block: Y.XmlElement<PivotTableBlock>): Promise<void>
}

export class PivotTableExecutor implements IPivotTableExecutor {
  private workspaceId: string
  private documentId: string
  private dataframes: Y.Map<DataFrame>
  private blocks: Y.Map<YBlock>
  private executionQueue: PQueue
  private running = new Map<Y.XmlElement<PivotTableBlock>, Set<Running>>()
  private effects: PivotTableEffects

  constructor(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    effects: PivotTableEffects
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataframes = dataframes
    this.blocks = blocks
    this.executionQueue = executionQueue
    this.effects = effects
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async abort(block: Y.XmlElement<PivotTableBlock>) {
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
      'aborting pivot table block run'
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
      'pivot table block run aborted'
    )
  }

  public async run(block: Y.XmlElement<PivotTableBlock>, tr: Y.Transaction) {
    return this._run(block, tr, 'create')
  }

  public async loadPage(
    block: Y.XmlElement<PivotTableBlock>,
    tr: Y.Transaction
  ) {
    return this._run(block, tr, 'read')
  }

  private async _run(
    block: Y.XmlElement<PivotTableBlock>,
    _tr: Y.Transaction,
    operation: 'create' | 'read'
  ) {
    const abortController = new AbortController()
    const running: Running = { abortController }

    const runs = this.running.get(block) ?? new Set()
    runs.add(running)
    this.running.set(block, runs)

    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          queueSize: this.executionQueue.size,
        },
        'enqueuing pivot table block run'
      )

      await this.executionQueue.add(
        async ({ signal }) => {
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
            return
          }

          const dataframe = this.dataframes.get(dataframeName)
          if (!dataframe) {
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

            if (
              rows.length === 0 ||
              cols.length === 0 ||
              metrics.length === 0
            ) {
              block.setAttribute('updatedAt', new Date().toISOString())
              block.setAttribute('error', null)
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
                return
              }
            }
          }

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

          running.abort = abort
          if (signal?.aborted) {
            await abort()
          }

          const result = await promise
          if (!result.success) {
            if (result.reason !== 'aborted') {
              block.setAttribute('error', result.reason)
            }
            return
          }

          block.setAttribute('updatedAt', new Date().toISOString())
          block.setAttribute('error', null)
          block.setAttribute('result', result.result)
          block.setAttribute('page', result.result.page)

          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
            },
            'pivot table block run completed'
          )
        },
        { signal: abortController.signal }
      )
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }

      block.setAttribute('error', 'unknown')
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
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    return new PivotTableExecutor(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue,
      { createPivotTable }
    )
  }
}
