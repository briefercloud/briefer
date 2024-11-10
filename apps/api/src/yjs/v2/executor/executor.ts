import * as Y from 'yjs'
import { WSSharedDocV2 } from '../index.js'
import {
  ExecutionQueue,
  ExecutionQueueBatch,
  ExecutionQueueItem,
  isPythonBlock,
  isSQLBlock,
  PythonBlock,
  SQLBlock,
  YBlock,
  ExecutionQueueItemPythonMetadata,
  ExecutionQueueItemSQLMetadata,
  isVisualizationBlock,
  ExecutionQueueItemVisualizationMetadata,
  VisualizationBlock,
  ExecutionQueueItemSQLRenameDataframeMetadata,
} from '@briefer/editor'
import { IPythonExecutor, PythonExecutor } from './python.js'
import { logger } from '../../../logger.js'
import { UserNotebookEvents } from '../../../events/user.js'
import { ISQLExecutor, SQLExecutor } from './sql.js'
import { config } from '../../../config/index.js'
import {
  IVisualizationExecutor,
  VisualizationExecutor,
} from './visualization.js'

export class Executor {
  private isRunning: boolean = false
  private timeout: NodeJS.Timeout | null = null
  private currentExecution: Promise<void> | null = null
  private queue: ExecutionQueue

  private constructor(
    private readonly pythonExecutor: IPythonExecutor,
    private readonly sqlExecutor: ISQLExecutor,
    private readonly visExecutor: IVisualizationExecutor,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly blocks: Y.Map<YBlock>,
    ydoc: Y.Doc
  ) {
    this.queue = ExecutionQueue.fromYjs(ydoc)
  }

  public start() {
    this.execute()
    this.isRunning = true
  }

  public async stop(): Promise<void> {
    this.isRunning = false

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    await this.currentExecution
  }

  private async execute() {
    const currentBatch = this.queue.getCurrentBatch()
    if (!currentBatch) {
      this.timeout = setTimeout(() => this.execute(), 500)
      return
    }

    this.currentExecution = this.makeBatchProgress(currentBatch)
    await this.currentExecution
    if (this.isRunning) {
      this.timeout = setTimeout(() => this.execute(), 0)
    }
  }

  private async makeBatchProgress(batch: ExecutionQueueBatch) {
    const current = batch.getCurrent()
    if (!current) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
        },
        'Could not get current item out of execution batch, advancing queue anyways to prevent infinite loop'
      )
      this.queue.advance()
      return
    }

    const status = current.getStatus()
    switch (status._tag) {
      case 'running':
      case 'enqueued':
        await this.executeItem(current)
      case 'error':
      case 'success':
      case 'aborted':
        break
      case 'aborting':
        current.setAborted()
        break
      default:
        exhaustiveCheck(status)
    }

    if (!current.isComplete()) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: current.getBlockId(),
        },
        'Execution item did not complete after calling executeItem, advancing queue anyways to prevent infinite loop'
      )
    }
    this.queue.advance()
  }

  private async executeItem(item: ExecutionQueueItem): Promise<void> {
    item.setRunning()
    const data = this.getExecutionItemData(item)
    if (!data) {
      return
    }

    switch (data._tag) {
      case 'python': {
        await this.pythonExecutor.run(item, data.block, data.metadata)
        break
      }
      case 'sql':
        await this.sqlExecutor.run(item, data.block, data.metadata)
        break
      case 'sql-rename-dataframe':
        await this.sqlExecutor.renameDataframe(item, data.block, data.metadata)
        break
      case 'visualization':
        await this.visExecutor.run(item, data.block, data.metadata)
        break
      default:
        exhaustiveCheck(data)
    }
  }

  private getExecutionItemData(
    item: ExecutionQueueItem
  ): ExecutionItemData | null {
    const metadata = item.getMetadata()
    switch (metadata._tag) {
      case 'python': {
        const block = this.blocks.get(item.getBlockId())
        if (!block) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Failed to find block for execution item'
          )
          return null
        }

        if (!isPythonBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for python execution'
          )
          return null
        }

        return { _tag: 'python', metadata, block }
      }
      case 'sql': {
        const block = this.blocks.get(item.getBlockId())
        if (!block) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Failed to find block for execution item'
          )
          return null
        }

        if (!isSQLBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for sql execution'
          )
          return null
        }

        return { _tag: 'sql', metadata, block }
      }
      case 'sql-rename-dataframe': {
        const block = this.blocks.get(item.getBlockId())
        if (!block) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Failed to find block for execution item'
          )
          return null
        }

        if (!isSQLBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for sql rename dataframe execution'
          )
          return null
        }

        return { _tag: 'sql-rename-dataframe', metadata, block }
      }
      case 'visualization': {
        const block = this.blocks.get(item.getBlockId())
        if (!block) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Failed to find block for execution item'
          )
          return null
        }

        if (!isVisualizationBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for visualization execution'
          )
          return null
        }

        return { _tag: 'visualization', metadata, block }
      }
      case 'noop':
        return null
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2): Executor {
    const events = new UserNotebookEvents(doc.workspaceId, doc.documentId)
    return new Executor(
      PythonExecutor.fromWSSharedDocV2(doc, events),
      SQLExecutor.fromWSSharedDocV2(
        doc,
        config().DATASOURCES_ENCRYPTION_KEY,
        events
      ),
      VisualizationExecutor.fromWSSharedDocV2(doc, events),
      doc.workspaceId,
      doc.documentId,
      doc.blocks,
      doc.ydoc
    )
  }
}

type ExecutionItemData =
  | {
      _tag: 'python'
      metadata: ExecutionQueueItemPythonMetadata
      block: Y.XmlElement<PythonBlock>
    }
  | {
      _tag: 'sql'
      metadata: ExecutionQueueItemSQLMetadata
      block: Y.XmlElement<SQLBlock>
    }
  | {
      _tag: 'sql-rename-dataframe'
      metadata: ExecutionQueueItemSQLRenameDataframeMetadata
      block: Y.XmlElement<SQLBlock>
    }
  | {
      _tag: 'visualization'
      metadata: ExecutionQueueItemVisualizationMetadata
      block: Y.XmlElement<VisualizationBlock>
    }

function exhaustiveCheck(_param: never) {}
