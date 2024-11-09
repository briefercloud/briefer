import { PythonBlock, YBlock } from '@briefer/editor'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import {
  IPythonExecutor,
  PythonExecutor,
} from '../../executors_/blocks/python.js'
import { DataFrame } from '@briefer/types'
import PQueue from 'p-queue'
import { PythonEvents } from '../../../../events/index.js'

export interface IPythonObserver extends IBlockObserver<PythonBlock> {}

export class PythonObserver implements IPythonObserver {
  private workspaceId: string
  private documentId: string
  private executor: IPythonExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    executor: IPythonExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<PythonBlock>) {
    // const status = block.getAttribute('status')
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     status,
    //   },
    //   'handling initial python block state'
    // )
    // if (status !== 'idle') {
    //   block.setAttribute('status', 'idle')
    // }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<PythonBlock>,
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
        'ignoring python block event'
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
      'handling python block event'
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
      'python block event handled'
    )
  }

  private async handleBlockStatusChange(
    block: Y.XmlElement<PythonBlock>,
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
    //   'Handling python block status change'
    // )
    // try {
    //   switch (status) {
    //     case 'run-requested':
    //       block.setAttribute('status', 'running')
    //       break
    //     case 'try-suggestion-requested':
    //       block.setAttribute('status', 'running-suggestion')
    //       break
    //     case 'abort-requested':
    //       block.setAttribute('status', 'aborting')
    //       break
    //     case 'aborting':
    //       await this.executor.abort(block, tr)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'running':
    //       await this.executor.run(block, tr, false)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'running-suggestion':
    //       await this.executor.run(block, tr, true)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'edit-with-ai-requested':
    //       block.setAttribute('status', 'edit-with-ai-running')
    //       break
    //     case 'edit-with-ai-running':
    //       await this.executor.editWithAI(block, tr)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'fix-with-ai-requested':
    //       block.setAttribute('status', 'fix-with-ai-running')
    //       break
    //     case 'fix-with-ai-running':
    //       await this.executor.fixWithAI(block, tr)
    //       block.setAttribute('status', 'idle')
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
    //     status,
    //   },
    //   'Finished handling python block status change'
    // )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    events: PythonEvents
  ) {
    const executor = PythonExecutor.make(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue,
      events
    )

    return new PythonObserver(workspaceId, documentId, executor)
  }
}
