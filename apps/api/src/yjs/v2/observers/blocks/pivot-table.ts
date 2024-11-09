import { PivotTableBlock, YBlock } from '@briefer/editor'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import { DataFrame } from '@briefer/types'
import PQueue from 'p-queue'
import {
  IPivotTableExecutor,
  PivotTableExecutor,
} from '../../executors_/blocks/pivot-table.js'

export interface IPivotTableObserver extends IBlockObserver<PivotTableBlock> {}

export class PivotTableObserver implements IPivotTableObserver {
  private workspaceId: string
  private documentId: string
  private executor: IPivotTableExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    executor: IPivotTableExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<PivotTableBlock>) {
    block.setAttribute('status', 'idle')
  }

  public async handleBlockEvent(
    block: Y.XmlElement<PivotTableBlock>,
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
        'Ignoring pivot table block event'
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
      'Handling pivot table block event'
    )

    try {
      if (key === 'status') {
        await this.handleBlockStatusChange(block, tr)
      }
    } catch (error) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
          error,
        },
        'Error while handling pivot table block event'
      )
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        action,
        key,
      },
      'PivotTable block event handled'
    )
  }

  private async handleBlockStatusChange(
    block: Y.XmlElement<PivotTableBlock>,
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
      'Handling pivot table block status change'
    )

    try {
      switch (status) {
        case 'run-requested':
          await this.executor.abort(block)
          block.setAttribute('status', 'running')
          break
        case 'running':
          await this.executor.run(block, tr)
          if (this.executor.isIdle()) {
            block.setAttribute('status', 'idle')
          }
          break
        case 'aborting':
          await this.executor.abort(block)
          block.setAttribute('status', 'idle')
          break
        case 'abort-requested':
          block.setAttribute('status', 'aborting')
          break
        case 'page-requested':
          await this.executor.abort(block)
          block.setAttribute('status', 'loading-page')
          break
        case 'loading-page':
          await this.executor.loadPage(block, tr)
          if (this.executor.isIdle()) {
            block.setAttribute('status', 'idle')
          }
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

      block.setAttribute('status', 'idle')
      block.setAttribute('error', 'unknown')
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId,
        status: block.getAttribute('status'),
      },
      'Finished handling pivot table block status change'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ): IPivotTableObserver {
    const executor = PivotTableExecutor.make(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue
    )
    return new PivotTableObserver(workspaceId, documentId, executor)
  }
}
