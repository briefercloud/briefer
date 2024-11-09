import { DateInputBlock, YBlock, getDateInputAttributes } from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import {
  IDateInputExecutor,
  DateInputExecutor,
} from '../../executors_/blocks/date-input.js'

export interface IDateInputObserver extends IBlockObserver<DateInputBlock> {}

export class DateInputObserver implements IDateInputObserver {
  private workspaceId: string
  private documentId: string
  private blocks: Y.Map<YBlock>
  private executor: IDateInputExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executor: IDateInputExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<DateInputBlock>) {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handling initial date input block state'
    )

    const status = getDateInputAttributes(block, this.blocks).status
    if (status !== 'idle') {
      block.setAttribute('status', 'idle')
    }

    this.executor.save(block)
  }

  public async handleBlockEvent(
    block: Y.XmlElement<DateInputBlock>,
    action: string,
    oldValue: any,
    key: string
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
        'Ignoring date input block event'
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
      'Handling date input block event'
    )

    if (key === 'status') {
      await this.handleBlockStatusChange(block)
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handled date input block event'
    )
  }

  private async handleBlockStatusChange(block: Y.XmlElement<DateInputBlock>) {
    const attrs = getDateInputAttributes(block, this.blocks)

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.status,
      },
      'Handling date input block status'
    )

    try {
      switch (attrs.status) {
        case 'idle':
          break
        case 'run-requested':
          block.setAttribute('status', 'running')
          break
        case 'running': {
          const success = await this.executor.save(block)
          if (success) {
            block.setAttribute('status', 'idle')
          }
          break
        }
        case 'run-all-running':
        case 'run-all-enqueued':
          // handled by run all observer
          break
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: attrs.id,
          status: attrs.status,
          err,
        },
        'Error while handling block status change'
      )
      block.setAttribute('status', 'idle')
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.status,
      },
      'finished handling date input block status change'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    const executor = DateInputExecutor.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )

    return new DateInputObserver(workspaceId, documentId, blocks, executor)
  }
}
