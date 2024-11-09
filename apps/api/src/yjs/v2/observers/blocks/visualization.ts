import { VisualizationBlock } from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import { DataFrame } from '@briefer/types'
import {
  IVisualizationExecutor,
  VisualizationExecutor,
} from '../../executors_/blocks/visualization.js'
import { VisEvents } from '../../../../events/index.js'

export interface IVisualizationObserver
  extends IBlockObserver<VisualizationBlock> {}

export class VisualizationObserver implements IVisualizationObserver {
  private workspaceId: string
  private documentId: string
  private executor: IVisualizationExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    executor: IVisualizationExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<VisualizationBlock>) {
    // const status = block.getAttribute('status')
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     status,
    //   },
    //   'handling initial visualization block state'
    // )
    // if (status !== 'idle') {
    //   block.setAttribute('status', 'idle')
    // }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<VisualizationBlock>,
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
        'Ignoring visualization block event'
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
      'Handling visualization block event'
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
        'Error while handling visualization block event'
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
      'Visualization block event handled'
    )
  }

  private async handleBlockStatusChange(
    block: Y.XmlElement<VisualizationBlock>,
    tr: Y.Transaction
  ) {
    // const blockId = block.getAttribute('id')
    // const status = block.getAttribute('status')
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId,
    //     status,
    //   },
    //   'Handling visualization block status change'
    // )
    // try {
    //   switch (status) {
    //     case 'run-requested':
    //       await this.executor.abort(block)
    //       block.setAttribute('status', 'running')
    //       break
    //     case 'running':
    //       await this.executor.run(block, tr)
    //       if (this.executor.isIdle()) {
    //         block.setAttribute('status', 'idle')
    //       }
    //       break
    //     case 'aborting':
    //       await this.executor.abort(block)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'abort-requested':
    //       block.setAttribute('status', 'aborting')
    //       break
    //   }
    // } catch (err) {
    //   logger().error(
    //     {
    //       workspaceId: this.workspaceId,
    //       documentId: this.documentId,
    //       blockId,
    //       status,
    //       err,
    //     },
    //     'Error while handling block status change'
    //   )
    //   // TODO: introduce an unexpetected error result
    //   block.setAttribute('status', 'idle')
    // }
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId,
    //     status: block.getAttribute('status'),
    //   },
    //   'Finished handling visualization block status change'
    // )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    executionQueue: PQueue,
    events: VisEvents
  ): IVisualizationObserver {
    const executor = VisualizationExecutor.make(
      workspaceId,
      documentId,
      dataframes,
      executionQueue,
      events
    )

    return new VisualizationObserver(workspaceId, documentId, executor)
  }
}
