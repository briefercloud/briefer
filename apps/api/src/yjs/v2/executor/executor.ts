import { v4 as uuidv4 } from 'uuid'
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
  ExecutionQueueItemTextInputSaveValueMetadata,
  InputBlock,
  ExecutionQueueItemTextInputRenameVariableMetadata,
  DateInputBlock,
  ExecutionQueueItemDateInputMetadata,
  isDateInputBlock,
  ExecutionQueueItemDropdownInputSaveValueMetadata,
  ExecutionQueueItemDropdownInputRenameVariableMetadata,
  isDropdownInputBlock,
  DropdownInputBlock,
  ExecutionQueueItemPivotTableMetadata,
  PivotTableBlock,
  ExecutionQueueItemPivotTableLoadPageMetadata,
  isPivotTableBlock,
  WritebackBlock,
  ExecutionQueueItemWritebackMetadata,
  isWritebackBlock,
  isTextInputBlock,
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
import { ITextInputExecutor, TextInputExecutor } from './text-input.js'
import { DateInputExecutor, IDateInputExecutor } from './date-input.js'
import {
  DropdownInputExecutor,
  IDropdownInputExecutor,
} from './dropdown-input.js'
import { IPivotTableExecutor, PivotTableExecutor } from './pivot-table.js'
import { IWritebackExecutor, WritebackExecutor } from './writeback.js'
import { ScheduleNotebookEvents } from '../../../events/schedule.js'
import { ApiUser, getUserById } from '@briefer/database'
import { acquireLock } from '../../../lock.js'
import { exhaustiveCheck } from '@briefer/types'

export function unknownUser(): ApiUser {
  return {
    id: 'unknown',
    name: 'unknown',
    email: 'unknown',
    picture: null,
    lastVisitedWorkspaceId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

export class Executor {
  private readonly id = uuidv4()
  private isRunning: boolean = false
  private currentExecution: Promise<void> | null = null
  private readonly queue: ExecutionQueue

  private constructor(
    private readonly docId: string,
    private readonly pythonExecutor: IPythonExecutor,
    private readonly sqlExecutor: ISQLExecutor,
    private readonly visExecutor: IVisualizationExecutor,
    private readonly textInputExecutor: ITextInputExecutor,
    private readonly dropdownInputExecutor: IDropdownInputExecutor,
    private readonly dateInputExecutor: IDateInputExecutor,
    private readonly pivotTableExecutor: IPivotTableExecutor,
    private readonly writebackExecutor: IWritebackExecutor,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly blocks: Y.Map<YBlock>,
    ydoc: Y.Doc
  ) {
    this.queue = ExecutionQueue.fromYjs(ydoc)
  }

  public start() {
    this.isRunning = true
    this.execute()
  }

  public isIdle() {
    return this.currentExecution === null
  }

  public async stop(): Promise<void> {
    this.isRunning = false
    await this.currentExecution
  }

  private async execute() {
    try {
      logger().debug(
        {
          port: process.env['PORT'],
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
        },
        'Acquiring executor lock'
      )

      await acquireLock(
        `executor:${this.docId}`,
        () =>
          new Promise<void>(async (resolve, reject) => {
            if (!this.isRunning) {
              logger().debug(
                {
                  port: process.env['PORT'],
                  id: this.id,
                  docId: this.docId,
                  workspaceId: this.workspaceId,
                  documentId: this.documentId,
                },
                'Executor lock acquired but executor is not running anymore. Exiting.'
              )
              resolve()
              return
            }

            logger().debug(
              {
                port: process.env['PORT'],
                id: this.id,
                docId: this.docId,
                workspaceId: this.workspaceId,
                documentId: this.documentId,
              },
              'Executor lock acquired. Executing queue'
            )

            const tick = async () => {
              try {
                if (!this.isRunning) {
                  logger().debug(
                    {
                      port: process.env['PORT'],
                      id: this.id,
                      docId: this.docId,
                      workspaceId: this.workspaceId,
                      documentId: this.documentId,
                    },
                    'Executor is not running. Stopping consumer loop.'
                  )
                  resolve()
                  return
                }

                const currentBatch = this.queue.getCurrentBatch()
                if (!currentBatch) {
                  setTimeout(() => tick(), 500)
                  return
                }

                logger().trace(
                  {
                    port: process.env['PORT'],
                    id: this.id,
                    docId: this.docId,
                    workspaceId: this.workspaceId,
                    documentId: this.documentId,
                    queueLength: this.queue.length,
                  },
                  'Making execution queue progress'
                )

                this.currentExecution = this.makeBatchProgress(currentBatch)
                await this.currentExecution
                this.currentExecution = null
                if (this.isRunning) {
                  setTimeout(() => tick(), 0)
                }
              } catch (err) {
                reject(err)
              }
            }

            tick()
          })
      )
    } catch (err) {
      logger().error(
        {
          port: process.env['PORT'],
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          err,
        },
        'Unexpected error while executing queue. Retrying in 2 seconds'
      )
      setTimeout(() => this.execute(), 2000)
    }
  }

  private async makeBatchProgress(batch: ExecutionQueueBatch) {
    logger().trace(
      {
        port: process.env['PORT'],
        id: this.id,
        docId: this.docId,
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        batchStatus: batch.status,
        batchRemaining: batch.remaining,
        batchLength: batch.length,
      },
      'Making batch progress'
    )

    const current = batch.getCurrent()
    if (!current) {
      logger().trace(
        {
          port: process.env['PORT'],
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
        },
        'Got to the end of current batch, advancing queue to next batch'
      )
      this.queue.advance()
      return
    }

    const status = current.getStatus()

    switch (status._tag) {
      // TODO: when we get a running execution item, instead of just executing again,
      // we should actually try to find out what happened to the previous execution
      case 'running':
      case 'enqueued':
        await this.executeItem(batch, current)
        break
      case 'completed':
        break
      case 'unknown':
      case 'aborting':
        // TODO: when getting here we should try to abort one more time
        current.setCompleted('aborted')
        break
      default:
        exhaustiveCheck(status)
    }

    if (current.getCompleteStatus() === null) {
      logger().error(
        {
          port: process.env['PORT'],
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: current.getBlockId(),
        },
        'Execution item did not complete after calling executeItem, advancing batch anyways to prevent infinite loop'
      )
      current.setCompleted('error')
    }
  }

  private async executeItem(
    batch: ExecutionQueueBatch,
    item: ExecutionQueueItem
  ): Promise<void> {
    logger().trace(
      {
        port: process.env['PORT'],
        id: this.id,
        docId: this.docId,
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: item.getBlockId(),
      },
      'Executing item'
    )

    item.setRunning()
    const data = this.getExecutionItemData(item)
    if (!data) {
      item.setCompleted('error')
      return
    }

    const events = await (async () => {
      const scheduleId = batch.getScheduleId()
      if (scheduleId) {
        return new ScheduleNotebookEvents(scheduleId)
      }

      let user: ApiUser | null = null
      const userId = item.getUserId()
      if (userId) {
        user = await getUserById(userId)
      }

      if (!user) {
        user = unknownUser()
      }

      return new UserNotebookEvents(this.workspaceId, this.documentId, user)
    })()

    switch (data._tag) {
      case 'python': {
        await this.pythonExecutor.run(item, data.block, data.metadata, events)
        break
      }
      case 'sql':
        await this.sqlExecutor.run(item, data.block, data.metadata, events)
        break
      case 'sql-rename-dataframe':
        await this.sqlExecutor.renameDataframe(
          item,
          data.block,
          data.metadata,
          events
        )
        break
      case 'visualization':
        await this.visExecutor.run(item, data.block, data.metadata, events)
        break
      case 'text-input-save-value':
        await this.textInputExecutor.saveValue(item, data.block, data.metadata)
        break
      case 'text-input-rename-variable':
        await this.textInputExecutor.renameVariable(
          item,
          data.block,
          data.metadata
        )
        break
      case 'dropdown-input-save-value':
        await this.dropdownInputExecutor.saveValue(
          item,
          data.block,
          data.metadata
        )
        break
      case 'dropdown-input-rename-variable':
        await this.dropdownInputExecutor.renameVariable(
          item,
          data.block,
          data.metadata
        )
        break
      case 'date-input':
        await this.dateInputExecutor.save(item, data.block, data.metadata)
        break
      case 'pivot-table':
        await this.pivotTableExecutor.run(item, data.block, data.metadata)
        break
      case 'pivot-table-load-page':
        await this.pivotTableExecutor.loadPage(item, data.block, data.metadata)
        break
      case 'writeback':
        await this.writebackExecutor.run(
          item,
          data.block,
          data.metadata,
          events
        )
        break
      default:
        exhaustiveCheck(data)
    }
  }

  private getExecutionItemData(
    item: ExecutionQueueItem
  ): ExecutionItemData | null {
    const metadata = item.getMetadata()
    const block = this.blocks.get(item.getBlockId())
    if (!block) {
      logger().error(
        {
          port: process.env['PORT'],
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: item.getBlockId(),
        },
        'Failed to find block for execution item'
      )
      return null
    }

    switch (metadata._tag) {
      case 'python': {
        if (!isPythonBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
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
      case 'sql':
      case 'sql-rename-dataframe': {
        if (!isSQLBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for sql execution'
          )
          return null
        }

        switch (metadata._tag) {
          case 'sql':
            return { _tag: 'sql', metadata, block }
          case 'sql-rename-dataframe':
            return { _tag: 'sql-rename-dataframe', metadata, block }
        }
      }
      case 'visualization': {
        if (!isVisualizationBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
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
      case 'text-input-save-value':
      case 'text-input-rename-variable': {
        if (!isTextInputBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for input execution'
          )
          return null
        }

        switch (metadata._tag) {
          case 'text-input-save-value':
            return { _tag: 'text-input-save-value', metadata, block }
          case 'text-input-rename-variable':
            return { _tag: 'text-input-rename-variable', metadata, block }
        }
      }
      case 'dropdown-input-save-value':
      case 'dropdown-input-rename-variable': {
        if (!isDropdownInputBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for input execution'
          )
          return null
        }

        switch (metadata._tag) {
          case 'dropdown-input-save-value':
            return { _tag: 'dropdown-input-save-value', metadata, block }
          case 'dropdown-input-rename-variable':
            return { _tag: 'dropdown-input-rename-variable', metadata, block }
        }
      }
      case 'date-input': {
        if (!isDateInputBlock(block)) {
          logger().error(
            {
              port: process.env['PORT'],
              id: this.id,
              docId: this.docId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for input execution'
          )
          return null
        }

        return { _tag: 'date-input', metadata, block }
      }

      case 'pivot-table':
      case 'pivot-table-load-page': {
        if (!isPivotTableBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for pivot table execution'
          )
          return null
        }

        switch (metadata._tag) {
          case 'pivot-table':
            return { _tag: 'pivot-table', metadata, block }
          case 'pivot-table-load-page':
            return { _tag: 'pivot-table-load-page', metadata, block }
        }
      }
      case 'writeback': {
        if (!isWritebackBlock(block)) {
          logger().error(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: item.getBlockId(),
            },
            'Got wrong block type for writeback execution'
          )
          return null
        }

        return { _tag: 'writeback', metadata, block }
      }
      case 'noop':
        return null
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2): Executor {
    return new Executor(
      doc.id,
      PythonExecutor.fromWSSharedDocV2(doc),
      SQLExecutor.fromWSSharedDocV2(doc, config().DATASOURCES_ENCRYPTION_KEY),
      VisualizationExecutor.fromWSSharedDocV2(doc),
      TextInputExecutor.fromWSSharedDocV2(doc),
      DropdownInputExecutor.fromWSSharedDocV2(doc),
      DateInputExecutor.fromWSSharedDocV2(doc),
      PivotTableExecutor.fromWSSharedDocV2(doc),
      WritebackExecutor.fromWSSharedDocV2(doc),
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
  | {
      _tag: 'text-input-save-value'
      metadata: ExecutionQueueItemTextInputSaveValueMetadata
      block: Y.XmlElement<InputBlock>
    }
  | {
      _tag: 'text-input-rename-variable'
      metadata: ExecutionQueueItemTextInputRenameVariableMetadata
      block: Y.XmlElement<InputBlock>
    }
  | {
      _tag: 'dropdown-input-save-value'
      metadata: ExecutionQueueItemDropdownInputSaveValueMetadata
      block: Y.XmlElement<DropdownInputBlock>
    }
  | {
      _tag: 'dropdown-input-rename-variable'
      metadata: ExecutionQueueItemDropdownInputRenameVariableMetadata
      block: Y.XmlElement<DropdownInputBlock>
    }
  | {
      _tag: 'date-input'
      metadata: ExecutionQueueItemDateInputMetadata
      block: Y.XmlElement<DateInputBlock>
    }
  | {
      _tag: 'pivot-table'
      metadata: ExecutionQueueItemPivotTableMetadata
      block: Y.XmlElement<PivotTableBlock>
    }
  | {
      _tag: 'pivot-table-load-page'
      metadata: ExecutionQueueItemPivotTableLoadPageMetadata
      block: Y.XmlElement<PivotTableBlock>
    }
  | {
      _tag: 'writeback'
      metadata: ExecutionQueueItemWritebackMetadata
      block: Y.XmlElement<WritebackBlock>
    }
