import { v4 as uuidv4 } from 'uuid'
import * as Y from 'yjs'
import PQueue from 'p-queue'
import {
  AI_TASK_PING_TIMEOUT,
  AITaskItem,
  AITasks,
  getBaseAttributes,
  isPythonBlock,
  isSQLBlock,
  YBlock,
} from '@briefer/editor'
import { WSSharedDocV2 } from '../../index.js'
import { logger } from '../../../../logger.js'
import { exhaustiveCheck } from '@briefer/types'
import { AIPythonExecutor, IPythonAIExecutor } from './python.js'
import { AISQLExecutor, ISQLAIExecutor } from './sql.js'
import { ApiUser, getUserById } from '@briefer/database'
import { unknownUser } from '../executor.js'
import { UserNotebookEvents } from '../../../../events/user.js'
import { acquireLock } from '../../../../lock.js'

class UnexpectedBlockTypeError extends Error {
  constructor(
    public readonly blockId: string,
    public readonly expectedType: string,
    public readonly actualType: string
  ) {
    super(
      `Block ${blockId} is expected to be of type ${expectedType}, but it is of type ${actualType}`
    )
  }
}

class BlockNotFoundError extends Error {
  constructor(public readonly blockId: string) {
    super(`Block ${blockId} not found`)
  }
}

export class AIExecutor {
  private readonly id = uuidv4()
  private isRunning = false
  private readonly pQueue = new PQueue({ concurrency: 4 })
  private timeout: NodeJS.Timeout | null = null

  private constructor(
    private readonly docId: string,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly tasks: AITasks,
    private readonly blocks: Y.Map<YBlock>,
    private readonly pythonAIExecutor: IPythonAIExecutor,
    private readonly sqlAIExecutor: ISQLAIExecutor
  ) {}

  public start() {
    this.isRunning = true
    this.execute()
  }

  public isIdle(): boolean {
    return this.pQueue.size === 0
  }

  public async stop(): Promise<void> {
    this.isRunning = false

    if (this.timeout) {
      clearTimeout(this.timeout)
    }

    await this.pQueue.onIdle()
  }

  private async execute() {
    try {
      logger().debug(
        {
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
        },
        'Acquiring AI tasks lock'
      )

      await acquireLock(
        `ai-tasks:${this.docId}`,
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
                'AI tasks lock acquired but executor is not running anymore. Exiting.'
              )
              resolve()
              return
            }

            logger().debug(
              {
                id: this.id,
                docId: this.docId,
                workspaceId: this.workspaceId,
                documentId: this.documentId,
              },
              'AI tasks lock acquired. Executing AI tasks'
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
                    'AI Tasks is not running. Stopping consumer loop.'
                  )
                  resolve()
                  return
                }

                await this.pQueue.onSizeLessThan(this.pQueue.concurrency)

                const next = this.tasks.next()
                let timeout = 500
                if (next) {
                  this.pQueue.add(() => this.executeItem(next))
                  timeout = 0
                }

                if (this.isRunning) {
                  this.timeout = setTimeout(() => tick(), timeout)
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
          id: this.id,
          docId: this.docId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          err,
        },
        'Unexpected error while executing AI tasks. Retrying in 2 seconds'
      )
      setTimeout(() => this.execute(), 2000)
    }
  }

  private async executeItem(task: AITaskItem) {
    const clearPing = this.startPinging(task)

    try {
      const metadata = task.getMetadata()
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          taskType: metadata._tag,
          tasksCount: this.tasks.size,
        },
        'Executing AI task'
      )

      const block = this.blocks.get(task.getBlockId())
      if (!block) {
        throw new BlockNotFoundError(task.getBlockId())
      }

      const events = await (async () => {
        let user: ApiUser | null = null
        const userId = task.getUserId()
        if (userId) {
          user = await getUserById(userId)
        }

        if (!user) {
          user = unknownUser()
        }

        return new UserNotebookEvents(this.workspaceId, this.documentId, user)
      })()

      switch (metadata._tag) {
        case 'noop':
          task.setCompleted('success')
          break
        case 'edit-python':
        case 'fix-python': {
          if (!isPythonBlock(block)) {
            throw new UnexpectedBlockTypeError(
              task.getBlockId(),
              'python',
              getBaseAttributes(block).type
            )
          }

          switch (metadata._tag) {
            case 'edit-python':
              await this.pythonAIExecutor.editWithAI(
                task,
                block,
                metadata,
                events
              )
              break
            case 'fix-python':
              await this.pythonAIExecutor.fixWithAI(
                task,
                block,
                metadata,
                events
              )
              break
            default:
              exhaustiveCheck(metadata)
          }
          break
        }
        case 'edit-sql':
        case 'fix-sql': {
          if (!isSQLBlock(block)) {
            throw new UnexpectedBlockTypeError(
              task.getBlockId(),
              'sql',
              getBaseAttributes(block).type
            )
          }

          switch (metadata._tag) {
            case 'edit-sql':
              await this.sqlAIExecutor.editWithAI(task, block, metadata, events)
              break
            case 'fix-sql':
              await this.sqlAIExecutor.fixWithAI(task, block, metadata, events)
              break
            default:
              exhaustiveCheck(metadata)
          }
          break
        }
        default:
          exhaustiveCheck(metadata)
      }
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: task.getBlockId(),
          err,
        },
        'Error executing AI task'
      )
      task.setCompleted('error')
    } finally {
      clearPing()
    }
  }

  private startPinging(task: AITaskItem): () => void {
    const interval = setInterval(() => {
      task.ping()
    }, AI_TASK_PING_TIMEOUT / 5)

    return () => {
      clearInterval(interval)
    }
  }

  public static fromWSSharedV2(doc: WSSharedDocV2): AIExecutor {
    return new AIExecutor(
      doc.id,
      doc.workspaceId,
      doc.documentId,
      AITasks.fromYjs(doc.ydoc),
      doc.blocks,
      AIPythonExecutor.fromWSSharedDocV2(doc),
      AISQLExecutor.fromWSSharedDocV2(doc)
    )
  }
}
