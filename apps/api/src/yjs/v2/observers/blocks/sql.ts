import { DataframeName, SQLBlock, YBlock } from '@briefer/editor'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import { ISQLExecutor, SQLExecutor } from '../../executors_/blocks/sql.js'
import { DataFrame } from '@briefer/types'
import PQueue from 'p-queue'
import { config } from '../../../../config/index.js'
import { SQLEvents } from '../../../../events/index.js'

export interface ISQLObserver extends IBlockObserver<SQLBlock> {}

export class SQLObserver implements ISQLObserver {
  private workspaceId: string
  private documentId: string
  private executor: ISQLExecutor

  constructor(workspaceId: string, documentId: string, executor: ISQLExecutor) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<SQLBlock>) {
    // const status = block.getAttribute('status')
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     status,
    //   },
    //   'handling initial sql block state'
    // )
    // if (status !== 'idle') {
    //   block.setAttribute('status', 'idle')
    // }
    // const dataframeName = block.getAttribute('dataframeName')
    // if (dataframeName && dataframeName?.status !== 'idle') {
    //   block.setAttribute('dataframeName', {
    //     ...dataframeName,
    //     status: 'idle',
    //   })
    // }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<SQLBlock>,
    action: string,
    oldValue: any,
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
        'ignoring sql block event'
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
      'Handling sql block event'
    )
    try {
      if (key === 'status') {
        await this.handleBlockStatusChange(block, tr)
      } else if (key === 'dataframeName') {
        await this.handleSQLBlockDataframeNameChange(block, oldValue)
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
          err,
        },
        'Error while handling sql block event'
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
      'Finished handling sql block event'
    )
  }

  private async handleBlockStatusChange(
    block: Y.XmlElement<SQLBlock>,
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
    //   'handling block status change'
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
    //       await this.executor.abortQuery(block)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'running':
    //       await this.executor.runQuery(block, tr, false, false)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'running-suggestion':
    //       await this.executor.runQuery(block, tr, true, false)
    //       block.setAttribute('status', 'idle')
    //       break
    //     case 'idle':
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
    //   block.setAttribute('status', 'idle')
    // }
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId,
    //     status,
    //   },
    //   'finished handling block status change'
    // )
  }

  private async handleSQLBlockDataframeNameChange(
    block: Y.XmlElement<SQLBlock>,
    oldValue: DataframeName
  ) {
    const dataframeName = block.getAttribute('dataframeName')
    if (!dataframeName) {
      return
    }

    if (dataframeName.status === oldValue.status) {
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        dataframeName,
      },
      'handling dataframe name change'
    )

    try {
      if (dataframeName.status === 'loading') {
        block.setAttribute('dataframeName', {
          ...dataframeName,
          status: 'running',
        })
      } else if (dataframeName.status === 'running') {
        await this.executor.renameDataFrame(block)
        const newDfName = block.getAttribute('dataframeName')
        block.setAttribute('dataframeName', {
          ...(newDfName ?? dataframeName),
          status: 'idle',
        })
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          dataframeName,
          err,
        },
        'Error while handling dataframe name change'
      )

      const newDfName = block.getAttribute('dataframeName')
      block.setAttribute('dataframeName', {
        ...(newDfName ?? dataframeName),
        status: 'idle',
        error: 'unexpected',
      })
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        dataframeName,
      },
      'finished handling dataframe name change'
    )
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    events: SQLEvents
  ) {
    const executor = SQLExecutor.make(
      workspaceId,
      documentId,
      config().DATASOURCES_ENCRYPTION_KEY,
      dataframes,
      blocks,
      executionQueue,
      events
    )

    return new SQLObserver(workspaceId, documentId, executor)
  }
}
