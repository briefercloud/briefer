import { WritebackBlock, getWritebackAttributes } from '@briefer/editor'

import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../../logger.js'
import { EventContext, WritebackEvents } from '../../../../events/index.js'
import { writeback } from '../../../../python/writeback/index.js'
import { listDataSources } from '@briefer/database'
import { config } from '../../../../config/index.js'

export type WritebackEffects = {
  writeback: typeof writeback
}

type RunningCode = {
  abortController: AbortController
  abort?: () => Promise<void>
}

export interface IWritebackExecutor {
  run(block: Y.XmlElement<WritebackBlock>, tr: Y.Transaction): Promise<void>
  abort(block: Y.XmlElement<WritebackBlock>): Promise<void>
  isIdle(): boolean
}

export class WritebackExecutor implements IWritebackExecutor {
  private workspaceId: string
  private documentId: string
  private executionQueue: PQueue
  private runningCode = new Map<Y.XmlElement<WritebackBlock>, RunningCode>()
  private effects: WritebackEffects
  private events: WritebackEvents

  constructor(
    workspaceId: string,
    documentId: string,
    executionQueue: PQueue,
    effects: WritebackEffects,
    events: WritebackEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executionQueue = executionQueue
    this.effects = effects
    this.events = events
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async run(block: Y.XmlElement<WritebackBlock>, tr: Y.Transaction) {
    this.events.writeback(EventContext.fromYTransaction(tr))

    const abortController = new AbortController()
    const runningCode: RunningCode = { abortController }
    this.runningCode.set(block, runningCode)
    block.setAttribute('result', null)

    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          queeueSize: this.executionQueue.size,
        },
        'enqueueing writeback block execution'
      )

      await this.executionQueue.add(
        async ({ signal }) => {
          const executedAt = new Date()
          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
            },
            'executing writeback block'
          )

          const attrs = getWritebackAttributes(block)

          const dataSources = await listDataSources(this.workspaceId)
          const dataSource = dataSources.find(
            (ds) => ds.data.id === attrs.dataSourceId
          )
          if (!dataSource) {
            block.setAttribute('status', 'idle')
            block.setAttribute('result', {
              _tag: 'error',
              step: 'validation',
              reason: 'datasource-not-found',
              executedAt: executedAt.toISOString(),
            })
            return
          }

          if (!attrs.dataframeName) {
            block.setAttribute('status', 'idle')
            block.setAttribute('result', {
              _tag: 'error',
              step: 'validation',
              reason: 'dataframe-not-found',
              executedAt: executedAt.toISOString(),
            })
            return
          }

          const tableName = attrs.tableName.toJSON()
          const { promise, abort } = await this.effects.writeback(
            this.workspaceId,
            this.documentId,
            attrs.dataframeName,
            dataSource,
            tableName,
            attrs.overwriteTable,
            attrs.onConflict,
            attrs.onConflictColumns,
            config().DATASOURCES_ENCRYPTION_KEY
          )
          runningCode.abort = abort
          if (signal?.aborted) {
            await abort()
          }

          const result = await promise

          block.setAttribute('status', 'idle')
          block.setAttribute('result', result)
          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
            },
            'writeback block executed'
          )
        },
        { signal: abortController.signal }
      )
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }

      throw e
    }
  }

  public async abort(block: Y.XmlElement<WritebackBlock>) {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'aborting writeback block execution'
    )

    const running = this.runningCode.get(block)
    if (!running) {
      block.setAttribute('status', 'idle')
      return
    }

    running.abortController.abort()
    await running.abort?.()

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'writeback block execution aborted'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    executionQueue: PQueue,
    events: WritebackEvents
  ) {
    return new WritebackExecutor(
      workspaceId,
      documentId,
      executionQueue,
      {
        writeback,
      },
      events
    )
  }
}
