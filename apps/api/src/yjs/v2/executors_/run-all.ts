import * as Y from 'yjs'
import PQueue from 'p-queue'
import { logger } from '../../../logger.js'
import {
  YBlock,
  YBlockGroup,
  YRunAll,
  getResultStatus,
  isExecutableBlock,
  switchBlockType,
  updateDropdownInputValue,
  updateInputValue,
} from '@briefer/editor'
import { ISQLExecutor, SQLExecutor } from './blocks/sql.js'
import { IPythonExecutor, PythonExecutor } from './blocks/python.js'
import {
  IVisualizationExecutor,
  VisualizationExecutor,
} from './blocks/visualization.js'
import { IInputExecutor, InputExecutor } from './blocks/input.js'
import { DataFrame } from '@briefer/types'
import { config } from '../../../config/index.js'
import {
  DropdownInputExecutor,
  IDropdownInputExecutor,
} from './blocks/dropdown-input.js'
import { NotebookEvents } from '../../../events/index.js'
import { IWritebackExecutor, WritebackExecutor } from './blocks/writeback.js'
import { IDateInputExecutor, DateInputExecutor } from './blocks/date-input.js'
import {
  IPivotTableExecutor,
  PivotTableExecutor,
} from './blocks/pivot-table.js'

export interface IRunAllExecutor {
  isIdle(): boolean
  run: (tr: Y.Transaction) => Promise<YBlock | null>
  abort: (tr: Y.Transaction) => Promise<void>
  getTotal(): number
}
type Executors = {
  sql: ISQLExecutor
  python: IPythonExecutor
  visualization: IVisualizationExecutor
  input: IInputExecutor
  dropdownInput: IDropdownInputExecutor
  writeback: IWritebackExecutor
  dateInput: IDateInputExecutor
  pivotTable: IPivotTableExecutor
}
export class RunAllExecutor implements IRunAllExecutor {
  private workspaceId: string
  private documentId: string
  private executionQueue: PQueue
  private abortController: AbortController | null = null
  private blocks: Y.Map<YBlock>
  private layout: Y.Array<YBlockGroup>
  private state: YRunAll
  private executors: Executors
  private currentBlock: YBlock | null = null

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    layout: Y.Array<YBlockGroup>,
    runAll: YRunAll,
    executionQueue: PQueue,
    executors: Executors
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.layout = layout
    this.state = runAll
    this.executionQueue = executionQueue
    this.executors = executors
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async run(tr: Y.Transaction): Promise<YBlock | null> {
    await this.abort(tr)
    this.currentBlock = null
    this.abortController = new AbortController()

    let currentBlock: YBlock | null = null
    try {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          queueSize: this.executionQueue.size,
        },
        'enqueueing run all execution'
      )
      await this.executionQueue.add(
        async ({ signal }) => {
          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blocks: this.blocks.size,
              layout: this.layout.length,
            },
            'executing run all'
          )

          const queue = this.computeQueue()

          this.state.doc!.transact(() => {
            this.state.setAttribute('total', queue.length)
            this.state.setAttribute('remaining', queue.length)

            queue.forEach((block) => {
              this.setBlockToRunAllEnqueued(block)
            })
          })

          logger().trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              queueSize: queue.length,
            },
            'created run all queue'
          )

          currentBlock = queue.shift() ?? null
          while (currentBlock) {
            this.state.setAttribute('remaining', queue.length)
            logger().trace(
              {
                workspaceId: this.workspaceId,
                documentId: this.documentId,
                blockId: currentBlock.getAttribute('id'),
                blockType: currentBlock.getAttribute('type'),
              },
              'running queue block'
            )

            if (signal?.aborted) {
              logger().trace(
                {
                  workspaceId: this.workspaceId,
                  documentId: this.documentId,
                  blockId: currentBlock.getAttribute('id'),
                  blockType: currentBlock.getAttribute('type'),
                },
                'run all aborted, setting block to idle'
              )
              this.setBlockToIdle(currentBlock)
              break
            }

            try {
              this.setBlockToRunAllRunning(currentBlock)
              logger().trace(
                {
                  workspaceId: this.workspaceId,
                  documentId: this.documentId,
                  blockId: currentBlock.getAttribute('id'),
                  blockType: currentBlock.getAttribute('type'),
                },
                'start running block'
              )
              await this.runBlock(currentBlock, tr)
              const resultStatus = getResultStatus(currentBlock, this.blocks)
              logger().trace(
                {
                  workspaceId: this.workspaceId,
                  documentId: this.documentId,
                  blockId: currentBlock.getAttribute('id'),
                  blockType: currentBlock.getAttribute('type'),
                  resultStatus,
                },
                'finished running block'
              )
              this.setBlockToIdle(currentBlock)
              if (resultStatus === 'error') {
                break
              }
            } catch (e) {
              this.setBlockToIdle(currentBlock)
              queue.forEach((block) => this.setBlockToIdle(block))
              throw e
            }

            currentBlock = queue.shift() ?? null
          }

          queue.forEach((block) => this.setBlockToIdle(block))
        },
        { signal: this.abortController.signal }
      )

      return currentBlock
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        logger().trace(
          {
            workspaceId: this.workspaceId,
            documentId: this.documentId,
          },
          'run all aborted'
        )
        return currentBlock
      }

      throw e
    } finally {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          queueSize: this.executionQueue.size,
        },
        'finished run all execution'
      )
      this.abortController = null
      this.currentBlock = null
    }
  }

  public async abort(tr: Y.Transaction) {
    this.abortController?.abort()
    await this.abortCurrentBlock(tr)
    await this.executionQueue.onIdle()
  }

  public getTotal() {
    const queue = this.computeQueue()
    return queue.length
  }

  private computeQueue() {
    const queue: YBlock[] = []

    this.layout.forEach((group) => {
      const tabs = group.getAttribute('tabs')
      if (!tabs) {
        return
      }

      tabs.forEach((tab) => {
        const blockId = tab.getAttribute('id')
        if (!blockId) {
          return
        }

        const block = this.blocks.get(blockId)
        if (!block) {
          return
        }

        if (isExecutableBlock(block)) {
          queue.push(block)
        }
      })
    })

    return queue
  }

  private async abortCurrentBlock(tr: Y.Transaction) {
    if (!this.currentBlock) {
      return
    }

    await switchBlockType(this.currentBlock, {
      onRichText: () => Promise.resolve(),
      onPython: (block) => this.executors.python.abort(block, tr),
      onSQL: (block) => this.executors.sql.abortQuery(block),
      onVisualization: (block) => this.executors.visualization.abort(block),
      onInput: async (block) => this.executors.input.abortSaveValue(block),
      onDropdownInput: (block) =>
        this.executors.dropdownInput.abortSaveValue(block),
      onWriteback: (block) => this.executors.writeback.abort(block),
      onDateInput: () => Promise.resolve(),
      onFileUpload: () => Promise.resolve(),
      onDashboardHeader: () => Promise.resolve(),
      onPivotTable: () =>
        this.executors.pivotTable.abort(this.currentBlock as Y.XmlElement),
    })
  }

  private setBlockToRunAllEnqueued(block: YBlock) {
    switchBlockType(block, {
      onRichText: () => {},
      onPython: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-enqueued')
      },
      onSQL: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-enqueued')
      },
      onVisualization: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-enqueued')
      },
      onInput: (block) => {
        updateInputValue(block, {
          status: 'run-all-enqueued',
        })
      },
      onWriteback: (block) => {
        block.setAttribute('status', 'run-all-enqueued')
      },
      onDropdownInput: (block) => {
        updateDropdownInputValue(block, {
          status: 'run-all-enqueued',
        })
      },
      onDateInput: (block) => {
        block.setAttribute('status', 'run-all-enqueued')
      },
      onFileUpload: () => {},
      onDashboardHeader: () => {},
      onPivotTable: (block) => {
        block.setAttribute('status', 'run-all-enqueued')
      },
    })
  }

  private setBlockToRunAllRunning(block: YBlock) {
    switchBlockType(block, {
      onRichText: () => {},
      onPython: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-running')
      },
      onSQL: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-running')
      },
      onVisualization: (block) => {
        // TODO
        // block.setAttribute('status', 'run-all-running')
      },
      onInput: (block) => {
        updateInputValue(block, {
          status: 'run-all-running',
        })
      },
      onDropdownInput: (block) => {
        updateDropdownInputValue(block, {
          status: 'run-all-running',
        })
      },
      onDateInput: (block) => {
        block.setAttribute('status', 'run-all-running')
      },
      onFileUpload: () => {},
      onDashboardHeader: () => {},
      onWriteback: (block) => {
        block.setAttribute('status', 'run-all-running')
      },
      onPivotTable: (block) => {
        block.setAttribute('status', 'run-all-running')
      },
    })
  }

  private setBlockToIdle(block: YBlock) {
    switchBlockType(block, {
      onRichText: () => {},
      onPython: (block) => {
        // TODO
        // block.setAttribute('status', 'idle')
      },
      onSQL: (block) => {
        // TODO
        // block.setAttribute('status', 'idle')
      },
      onVisualization: (block) => {
        // TODO
        // block.setAttribute('status', 'idle')
      },
      onInput: (block) => {
        updateInputValue(block, {
          status: 'idle',
        })
      },
      onDropdownInput: (block) => {
        updateDropdownInputValue(block, {
          status: 'idle',
        })
      },
      onDateInput: (block) => {
        block.setAttribute('status', 'idle')
      },
      onFileUpload: () => {},
      onDashboardHeader: () => {},
      onWriteback: (block) => {
        block.setAttribute('status', 'idle')
      },
      onPivotTable: (block) => {
        block.setAttribute('status', 'idle')
      },
    })
  }

  private async runBlock(block: YBlock, tr: Y.Transaction) {
    this.currentBlock = block

    await switchBlockType(block, {
      onRichText: () => Promise.resolve(),
      onPython: (block) => this.executors.python.run(block, tr, false),
      onSQL: (block) => this.executors.sql.runQuery(block, tr, false, true),
      onVisualization: (block) => this.executors.visualization.run(block, tr),
      onInput: (block) => this.executors.input.saveValue(block),
      onDropdownInput: (block) => this.executors.dropdownInput.saveValue(block),
      onDateInput: async (block) => {
        await this.executors.dateInput.save(block)
      },
      onFileUpload: () => Promise.resolve(),
      onDashboardHeader: () => Promise.resolve(),
      onWriteback: (block) => this.executors.writeback.run(block, tr),
      onPivotTable: () =>
        this.executors.pivotTable.run(this.currentBlock as Y.XmlElement, tr),
    })
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    layout: Y.Array<YBlockGroup>,
    state: YRunAll,
    dataframes: Y.Map<DataFrame>,
    mainExecutionQueue: PQueue,
    events: NotebookEvents
  ) {
    const runAllExecutionQueue = new PQueue({ concurrency: 1 })

    const executors = {
      sql: SQLExecutor.make(
        workspaceId,
        documentId,
        config().DATASOURCES_ENCRYPTION_KEY,
        dataframes,
        blocks,
        runAllExecutionQueue,
        events
      ),
      python: PythonExecutor.make(
        workspaceId,
        documentId,
        dataframes,
        blocks,
        runAllExecutionQueue,
        events
      ),
      visualization: VisualizationExecutor.make(
        workspaceId,
        documentId,
        dataframes,
        runAllExecutionQueue,
        events
      ),
      input: InputExecutor.make(
        workspaceId,
        documentId,
        blocks,
        runAllExecutionQueue
      ),
      dropdownInput: DropdownInputExecutor.make(
        workspaceId,
        documentId,
        blocks,
        runAllExecutionQueue
      ),
      writeback: WritebackExecutor.make(
        workspaceId,
        documentId,
        runAllExecutionQueue,
        events
      ),
      dateInput: new DateInputExecutor(
        workspaceId,
        documentId,
        blocks,
        runAllExecutionQueue
      ),
      pivotTable: PivotTableExecutor.make(
        workspaceId,
        documentId,
        dataframes,
        blocks,
        runAllExecutionQueue
      ),
    }

    return new RunAllExecutor(
      workspaceId,
      documentId,
      blocks,
      layout,
      state,
      mainExecutionQueue,
      executors
    )
  }
}
