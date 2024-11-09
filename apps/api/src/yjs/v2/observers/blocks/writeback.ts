import { WritebackBlock } from '@briefer/editor'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import {
  IWritebackExecutor,
  WritebackExecutor,
} from '../../executors_/blocks/writeback.js'
import PQueue from 'p-queue'
import { WritebackEvents } from '../../../../events/index.js'

export interface IWritebackObserver extends IBlockObserver<WritebackBlock> {}

export class WritebackObserver implements IWritebackObserver {
  private workspaceId: string
  private documentId: string
  private executor: IWritebackExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    executor: IWritebackExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<WritebackBlock>) {
    const status = block.getAttribute('status')

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        status,
      },
      'handling initial writeback block state'
    )

    if (status !== 'idle') {
      block.setAttribute('status', 'idle')
    }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<WritebackBlock>,
    action: string,
    _oldValue: any,
    key: string,
    tr: Y.Transaction
  ) {
    if (action !== 'update') {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
        },
        'ignoring writeback block event'
      )
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        action,
        key,
      },
      'handling writeback block event'
    )

    if (key === 'status') {
      await this.handleBlockStatusChange(block, tr)
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'writeback block event handled'
    )
  }

  private async handleBlockStatusChange(
    block: Y.XmlElement<WritebackBlock>,
    tr: Y.Transaction
  ) {
    const blockId = block.getAttribute('id')
    const status = block.getAttribute('status')

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId,
        status,
      },
      'Handling writeback block status change'
    )

    try {
      switch (status) {
        case 'run-requested':
          block.setAttribute('status', 'running')
          break
        case 'abort-requested':
          block.setAttribute('status', 'aborting')
          break
        case 'aborting':
          await this.executor.abort(block)
          block.setAttribute('status', 'idle')
          break
        case 'running':
          await this.executor.run(block, tr)
          block.setAttribute('status', 'idle')
          break
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId,
          status,
          err,
        },
        'Error while handling block status change'
      )

      // TODO: introduce an unexpetected error result
      block.setAttribute('status', 'idle')
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId,
        status,
      },
      'Finished handling writeback block status change'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    executionQueue: PQueue,
    events: WritebackEvents
  ) {
    const executor = WritebackExecutor.make(
      workspaceId,
      documentId,
      executionQueue,
      events
    )

    return new WritebackObserver(workspaceId, documentId, executor)
  }
}
