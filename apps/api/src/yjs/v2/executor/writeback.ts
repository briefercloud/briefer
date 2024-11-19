import {
  ExecutionQueueItem,
  ExecutionQueueItemWritebackMetadata,
  WritebackBlock,
  getWritebackAttributes,
} from '@briefer/editor'

import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import { WritebackEvents } from '../../../events/index.js'
import { writeback } from '../../../python/writeback/index.js'
import { listDataSources } from '@briefer/database'
import { config } from '../../../config/index.js'
import { WSSharedDocV2 } from '../index.js'

export type WritebackEffects = {
  writeback: typeof writeback
}

export interface IWritebackExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<WritebackBlock>,
    metadata: ExecutionQueueItemWritebackMetadata
  ): Promise<void>
}

export class WritebackExecutor implements IWritebackExecutor {
  private workspaceId: string
  private documentId: string
  private effects: WritebackEffects
  private events: WritebackEvents

  constructor(
    workspaceId: string,
    documentId: string,
    effects: WritebackEffects,
    events: WritebackEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.effects = effects
    this.events = events
  }

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<WritebackBlock>,
    _metadata: ExecutionQueueItemWritebackMetadata
  ) {
    // TODO
    // this.events.writeback(EventContext.fromYTransaction(tr))

    block.setAttribute('result', null)

    try {
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

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      const dataSources = await listDataSources(this.workspaceId)

      if (aborted) {
        cleanup()
        executionItem.setCompleted()
        return
      }

      const dataSource = dataSources.find(
        (ds) => ds.data.id === attrs.dataSourceId
      )
      if (!dataSource) {
        block.setAttribute('result', {
          _tag: 'error',
          step: 'validation',
          reason: 'datasource-not-found',
          executedAt: executedAt.toISOString(),
        })
        executionItem.setCompleted()
        cleanup()
        return
      }

      if (!attrs.dataframeName) {
        block.setAttribute('result', {
          _tag: 'error',
          step: 'validation',
          reason: 'dataframe-not-found',
          executedAt: executedAt.toISOString(),
        })
        executionItem.setCompleted()
        cleanup()
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
      await abortP
      cleanup()

      block.setAttribute('result', result)
      executionItem.setCompleted()
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: executionItem.getBlockId(),
          result: result._tag,
        },
        'writeback block executed'
      )
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: executionItem.getBlockId(),
          err,
        },
        'writeback block error'
      )
      executionItem.setCompleted()
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2, events: WritebackEvents) {
    return new WritebackExecutor(
      doc.workspaceId,
      doc.documentId,
      {
        writeback,
      },
      events
    )
  }
}
