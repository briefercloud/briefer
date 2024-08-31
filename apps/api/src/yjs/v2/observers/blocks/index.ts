import { YBlock, getBaseAttributes, switchBlockType } from '@briefer/editor'
import { ISQLObserver, SQLObserver } from './sql.js'
import { IPythonObserver, PythonObserver } from './python.js'
import {
  IVisualizationObserver,
  VisualizationObserver,
} from './visualization.js'
import { logger } from '../../../../logger.js'
import { IInputObserver, InputObserver } from './input.js'
import {
  IDropdownInputObserver,
  DropdownInputObserver,
} from './dropdown-input.js'
import { DataFrame } from '@briefer/types'
import * as Y from 'yjs'
import { ValueTypes } from 'yjs/dist/src/internals'
import PQueue from 'p-queue'
import { FileUploadObserver, IFileUploadObserver } from './file-upload.js'
import {
  EventContext,
  NotebookBlockEvents,
  NotebookEvents,
} from '../../../../events/index.js'
import { IWritebackObserver, WritebackObserver } from './writeback.js'
import { DateInputObserver, IDateInputObserver } from './date-input.js'
import { IPivotTableObserver, PivotTableObserver } from './pivot-table.js'

export interface IBlockObserver<T extends { [key: string]: ValueTypes }> {
  isIdle: () => boolean
  handleInitialBlockState(block: Y.XmlElement<T>): void
  handleBlockEvent(
    block: Y.XmlElement<T>,
    action: string,
    oldValue: any,
    key: string,
    tr: Y.Transaction
  ): Promise<void>
}

export interface IBlocksObserver {
  start(): void
  stop(): void
  isIdle(): boolean
}

export class BlocksObserver implements IBlocksObserver {
  private readonly workspaceId: string
  private readonly documentId: string
  private readonly blocks: Y.Map<YBlock>
  private readonly sqlBlocksObserver: ISQLObserver
  private readonly pythonBlocksObserver: IPythonObserver
  private readonly visualizationBlockObserver: IVisualizationObserver
  private readonly inputBlocksObserver: IInputObserver
  private readonly dropdownInputBlocksObserver: IDropdownInputObserver
  private readonly dateInputBlocksObserver: IDateInputObserver
  private readonly fileUploadBlocksObserver: IFileUploadObserver
  private readonly writebackBlocksObserver: IWritebackObserver
  private readonly pivotTableBlocksObserver: IPivotTableObserver
  private readonly events: NotebookBlockEvents

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    sqlBlocksObserver: ISQLObserver,
    pythonBlocksObserver: IPythonObserver,
    visualizationBlocksObserver: IVisualizationObserver,
    inputBlocksObserver: IInputObserver,
    dropdownInputBlocksObserver: IDropdownInputObserver,
    dateInputBlocksObserver: IDateInputObserver,
    fileUploadBlocksObserver: IFileUploadObserver,
    writebackBlocksObserver: IWritebackObserver,
    pivotTableBlocksObserver: IPivotTableObserver,
    events: NotebookBlockEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.sqlBlocksObserver = sqlBlocksObserver
    this.pythonBlocksObserver = pythonBlocksObserver
    this.visualizationBlockObserver = visualizationBlocksObserver
    this.inputBlocksObserver = inputBlocksObserver
    this.dropdownInputBlocksObserver = dropdownInputBlocksObserver
    this.dateInputBlocksObserver = dateInputBlocksObserver
    this.fileUploadBlocksObserver = fileUploadBlocksObserver
    this.writebackBlocksObserver = writebackBlocksObserver
    this.pivotTableBlocksObserver = pivotTableBlocksObserver
    this.events = events
  }

  public isIdle() {
    return (
      this.sqlBlocksObserver.isIdle() &&
      this.pythonBlocksObserver.isIdle() &&
      this.visualizationBlockObserver.isIdle() &&
      this.inputBlocksObserver.isIdle() &&
      this.dropdownInputBlocksObserver.isIdle() &&
      this.dateInputBlocksObserver.isIdle() &&
      this.fileUploadBlocksObserver.isIdle() &&
      this.writebackBlocksObserver.isIdle() &&
      this.pivotTableBlocksObserver.isIdle()
    )
  }

  public start() {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'starting blocks observer'
    )

    this.blocks.forEach((block) => {
      try {
        block.observe(this.onBlockEvent)
        this.handleInitialBlockState(block)
      } catch (err) {
        logger.error(
          {
            workspaceId: this.workspaceId,
            documentId: this.documentId,
            blockId: block.getAttribute('id'),
            error: err,
          },
          'Failed to observe block'
        )
      }
    })

    this.blocks.observe(this.onBlocksEvent)
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'blocks observer started'
    )
  }

  public stop() {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'stopping blocks observer'
    )

    this.blocks.forEach((block) => {
      block.unobserve(this.onBlockEvent)
    })

    this.blocks.unobserve(this.onBlocksEvent)
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      },
      'blocks observer stopped'
    )
  }

  private handleInitialBlockState(block: YBlock) {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handling initial block state'
    )

    switchBlockType(block, {
      onPython: (b) => this.pythonBlocksObserver.handleInitialBlockState(b),
      onSQL: (b) => this.sqlBlocksObserver.handleInitialBlockState(b),
      onVisualization: (b) =>
        this.visualizationBlockObserver.handleInitialBlockState(b),
      onWriteback: (b) =>
        this.writebackBlocksObserver.handleInitialBlockState(b),
      onInput: (b) => this.inputBlocksObserver.handleInitialBlockState(b),
      onDropdownInput: (b) =>
        this.dropdownInputBlocksObserver.handleInitialBlockState(b),
      onDateInput: (b) =>
        this.dateInputBlocksObserver.handleInitialBlockState(b),
      onRichText: () => {},
      onFileUpload: (b) =>
        this.fileUploadBlocksObserver.handleInitialBlockState(b),
      onDashboardHeader: () => {},
      onPivotTable: (b) => {
        this.pivotTableBlocksObserver.handleInitialBlockState(b)
      },
    })
  }

  private onBlockEvent = (event: Y.YXmlEvent, tr: Y.Transaction) => {
    tr.doc.transact(() => {
      event.changes.keys.forEach(({ action, oldValue }, key) => {
        const block = event.target

        if (block instanceof Y.XmlElement) {
          logger.trace(
            {
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
              action,
              key,
            },
            'handling block event'
          )

          switchBlockType(block, {
            onPython: (b) =>
              this.pythonBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onSQL: (b) =>
              this.sqlBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onVisualization: (b) =>
              this.visualizationBlockObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onWriteback: (b) =>
              this.writebackBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onInput: (b) =>
              this.inputBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onDropdownInput: (b) =>
              this.dropdownInputBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onDateInput: (b) =>
              this.dateInputBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onRichText: () => {},
            onFileUpload: (b) =>
              this.fileUploadBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
            onDashboardHeader: () => {},
            onPivotTable: (b) =>
              this.pivotTableBlocksObserver.handleBlockEvent(
                b,
                action,
                oldValue,
                key,
                tr
              ),
          })
        }
      })
    }, tr.origin)
  }

  private onBlocksEvent = (event: Y.YMapEvent<YBlock>, tr: Y.Transaction) => {
    event.changes.keys.forEach(({ action }, key) => {
      if (action === 'add') {
        const block = event.target.get(key)
        if (block) {
          this.events.blockAdd(
            EventContext.fromYTransaction(tr),
            getBaseAttributes(block).type
          )
          this.handleInitialBlockState(block)
          block.observe(this.onBlockEvent)
        }
      }
    })
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    dataframes: Y.Map<DataFrame>,
    executionQueue: PQueue,
    events: NotebookEvents
  ): BlocksObserver {
    const sqlObserver = SQLObserver.make(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue,
      events
    )
    const pythonObserver = PythonObserver.make(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue,
      events
    )
    const visualizationObserver = VisualizationObserver.make(
      workspaceId,
      documentId,
      dataframes,
      executionQueue,
      events
    )
    const inputObserver = InputObserver.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )
    const dropdownInputObserver = DropdownInputObserver.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )
    const dateInputObserver = DateInputObserver.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )
    const fileUploadObserver = FileUploadObserver.make(workspaceId, documentId)
    const writebackObserver = WritebackObserver.make(
      workspaceId,
      documentId,
      executionQueue,
      events
    )

    const pivotTableObserver = PivotTableObserver.make(
      workspaceId,
      documentId,
      dataframes,
      blocks,
      executionQueue
    )

    return new BlocksObserver(
      workspaceId,
      documentId,
      blocks,
      sqlObserver,
      pythonObserver,
      visualizationObserver,
      inputObserver,
      dropdownInputObserver,
      dateInputObserver,
      fileUploadObserver,
      writebackObserver,
      pivotTableObserver,
      events
    )
  }
}
