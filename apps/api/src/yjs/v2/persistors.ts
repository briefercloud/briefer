import * as Y from 'yjs'
import prisma, { PrismaTransaction } from '@briefer/database'
import { TransactionOrigin, WSSharedDocV2 } from './index.js'
import { logger } from '../../logger.js'
import { decoding } from 'lib0'
import { readUpdate } from 'y-protocols/sync.js'
import {
  FileUploadBlock,
  InputBlock,
  PythonBlock,
  SQLBlock,
  VisualizationBlock,
  YBlock,
  YBlockGroup,
  compareText,
  getBlocks,
  getLayout,
  switchBlockType,
  DashboardHeaderBlock,
  getBaseAttributes,
  getInputAttributes,
  isInputBlock,
  DropdownInputBlock,
  getDropdownInputAttributes,
  isDropdownInputBlock,
  DateInputBlock,
  isDateInputBlock,
  getDateInputAttributes,
  PivotTableBlock,
} from '@briefer/editor'
import { equals, omit } from 'ramda'
import { uuidv4 } from 'lib0/random.js'
import { getYDocWithoutHistory } from './documents.js'
import { WritebackBlock } from '@briefer/editor/types/blocks/writeback.js'
import { acquireLock } from '../../lock.js'

export type LoadStateResult = {
  ydoc: Y.Doc
  clock: number
  byteLength: number
}
type CleanHistoryResult = LoadStateResult
export interface Persistor {
  load: (tx?: PrismaTransaction) => Promise<LoadStateResult>
  persist: (ydoc: WSSharedDocV2, tx?: PrismaTransaction) => Promise<number>
  cleanHistory: (
    ydoc: WSSharedDocV2,
    tx?: PrismaTransaction
  ) => Promise<CleanHistoryResult>
  canWrite: (
    decoder: decoding.Decoder,
    doc: WSSharedDocV2,
    transactionOrigin: TransactionOrigin
  ) => boolean
  replaceState: (newState: Buffer) => Promise<LoadStateResult>
}

export class DocumentPersistor implements Persistor {
  constructor(private readonly documentId: string) {}

  private applyUpdate(ydoc: Y.Doc, update: Buffer) {
    Y.applyUpdate(ydoc, update)
  }

  public async load(tx?: PrismaTransaction) {
    try {
      return acquireLock(`document:${this.documentId}`, () => this._load(tx))
    } catch (err) {
      logger.error(
        { documentId: this.documentId, err },
        'Failed to load Yjs document state'
      )
      throw err
    }
  }

  private async _load(tx?: PrismaTransaction) {
    const ydoc = new Y.Doc()
    const dbDoc = await (tx ?? prisma()).yjsDocument.findUnique({
      where: { documentId: this.documentId },
    })

    if (!dbDoc) {
      return {
        ydoc,
        clock: 0,
        byteLength: Y.encodeStateAsUpdate(ydoc).length,
      }
    }

    this.applyUpdate(ydoc, dbDoc.state)

    return {
      ydoc,
      clock: dbDoc.clock,
      byteLength: dbDoc.state.length,
    }
  }

  public async persist(ydoc: WSSharedDocV2, tx?: PrismaTransaction) {
    try {
      return acquireLock(`document:${this.documentId}`, () =>
        this._persist(ydoc, tx)
      )
    } catch (err) {
      logger.error(
        { documentId: this.documentId, err },
        'Failed to persist Yjs document'
      )
      throw err
    }
  }

  private async _persist(ydoc: WSSharedDocV2, tx?: PrismaTransaction) {
    const save = async (state: Buffer, tx: PrismaTransaction) => {
      const doc = await tx.document.findUnique({
        where: { id: this.documentId },
      })
      if (!doc) {
        logger.trace(
          { documentId: this.documentId },
          'Document was deleted, not persisting state'
        )
        return
      }

      await tx.yjsDocument.upsert({
        where: { documentId: this.documentId },
        create: {
          documentId: this.documentId,
          state,
        },
        update: {
          state,
        },
        select: {
          id: true,
        },
      })

      await tx.document.update({
        where: { id: this.documentId },
        data: {
          isSyncedWithYjs: true,
        },
      })
    }

    const state = Buffer.from(Y.encodeStateAsUpdate(ydoc.ydoc))
    await save(state, tx ?? prisma())
    return state.length
  }

  public canWrite(
    _decoder: decoding.Decoder,
    _doc: WSSharedDocV2,
    transactionOrigin: TransactionOrigin
  ) {
    switch (transactionOrigin.role) {
      case 'admin':
      case 'editor':
        return true
      case 'viewer':
        return false
    }
  }

  public async cleanHistory(wsdoc: WSSharedDocV2, tx?: PrismaTransaction) {
    return acquireLock(`document:${this.documentId}`, () =>
      this._cleanHistory(wsdoc, tx)
    )
  }

  private async _cleanHistory(wsdoc: WSSharedDocV2, tx?: PrismaTransaction) {
    const ydoc = getYDocWithoutHistory(wsdoc)
    const state = Y.encodeStateAsUpdate(ydoc)
    const buffer = Buffer.from(state)

    const yjsAppDoc = await (tx ?? prisma()).yjsDocument.upsert({
      where: { documentId: this.documentId },
      create: {
        documentId: this.documentId,
        state: buffer,
      },
      update: {
        clock: {
          increment: 1,
        },
        state: buffer,
      },
    })

    return {
      ydoc,
      clock: yjsAppDoc.clock,
      byteLength: state.byteLength,
    }
  }

  public async replaceState(newState: Buffer) {
    const clock = await prisma().yjsDocument.update({
      where: { documentId: this.documentId },
      data: {
        state: newState,
        clock: {
          increment: 1,
        },
      },
    })

    const ydoc = new Y.Doc()
    this.applyUpdate(ydoc, newState)

    return {
      ydoc,
      clock: clock.clock,
      byteLength: newState.length,
    }
  }
}

export class AppPersistor implements Persistor {
  constructor(
    private readonly yjsAppDocumentId: string,
    // no user means we are manipulating the published state
    private readonly userId: string | null
  ) {}

  private applyUpdate(ydoc: Y.Doc, update: Buffer | Uint8Array) {
    Y.applyUpdate(ydoc, update)
  }

  public async load(tx?: PrismaTransaction | undefined) {
    try {
      return acquireLock(`app:${this.yjsAppDocumentId}`, () => this._load(tx))
    } catch (err) {
      logger.error(
        { yjsAppDocumentId: this.yjsAppDocumentId, userId: this.userId, err },
        'Failed to load Yjs app document state'
      )
      throw err
    }
  }

  private async _load(tx?: PrismaTransaction | undefined) {
    const bind = async (tx: PrismaTransaction) => {
      const yjsAppDoc = await tx.yjsAppDocument.findFirstOrThrow({
        where: {
          id: this.yjsAppDocumentId,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          userYjsAppDocuments: {
            where: {
              // use a new uuid when there is no user
              // since uuid is always unique, nothing
              // will be returned, which means we will
              // be manipulating the published state
              userId: this.userId ?? uuidv4(),
            },
          },
        },
      })

      const ydoc = new Y.Doc()
      const userYjsAppDoc = yjsAppDoc.userYjsAppDocuments[0]
      let byteLength = userYjsAppDoc?.state.length ?? yjsAppDoc.state.length
      let clock = userYjsAppDoc?.clock ?? yjsAppDoc.clock
      if (!userYjsAppDoc || !this.userId) {
        // no user or user never opened the app before. bind to the published state
        this.applyUpdate(ydoc, yjsAppDoc.state)
      } else {
        // bind to the user's state
        this.applyUpdate(ydoc, userYjsAppDoc.state)
      }

      return {
        ydoc,
        clock,
        byteLength,
      }
    }

    if (tx) {
      return await bind(tx)
    }

    return await prisma().$transaction(bind, {
      maxWait: 31000,
      timeout: 30000,
    })
  }

  public async persist(ydoc: WSSharedDocV2, tx?: PrismaTransaction) {
    try {
      return acquireLock(`app:${this.yjsAppDocumentId}`, () =>
        this._persist(ydoc, tx)
      )
    } catch (err) {
      logger.error(
        { yjsAppDocumentId: this.yjsAppDocumentId, userId: this.userId, err },
        'Failed to persist Yjs app document'
      )
      throw err
    }
  }

  private async _persist(ydoc: WSSharedDocV2, tx?: PrismaTransaction) {
    const upsert = async (tx: PrismaTransaction) => {
      const state = Buffer.from(Y.encodeStateAsUpdate(ydoc.ydoc))
      if (this.userId) {
        const userChangedState = await this.userChangedState(ydoc, tx)
        // update this user specific state
        await tx.userYjsAppDocument.upsert({
          where: {
            yjsAppDocumentId_userId: {
              yjsAppDocumentId: this.yjsAppDocumentId,
              userId: this.userId,
            },
          },
          create: {
            userId: this.userId,
            yjsAppDocumentId: this.yjsAppDocumentId,
            userChangedState,
            state,
          },
          update: {
            state,
            userChangedState,
          },
        })
      } else {
        // no user means we are manipulating the published state
        await tx.yjsAppDocument.update({
          where: {
            id: this.yjsAppDocumentId,
          },
          data: {
            state,
          },
        })

        // update all user states that have not changed
        // to be in sync with the published state
        await tx.userYjsAppDocument.updateMany({
          where: {
            yjsAppDocumentId: this.yjsAppDocumentId,
            userChangedState: false,
          },
          data: {
            state,
          },
        })
      }

      return state.length
    }

    return await upsert(tx ?? prisma())
  }

  public async cleanHistory(wsdoc: WSSharedDocV2, tx?: PrismaTransaction) {
    return acquireLock(`app:${this.yjsAppDocumentId}`, () =>
      this._cleanHistory(wsdoc, tx)
    )
  }

  private async _cleanHistory(wsdoc: WSSharedDocV2, tx?: PrismaTransaction) {
    const ydoc = getYDocWithoutHistory(wsdoc)

    if (this.userId) {
      const yjsAppDoc = await (tx ?? prisma()).userYjsAppDocument.update({
        where: {
          yjsAppDocumentId_userId: {
            yjsAppDocumentId: this.yjsAppDocumentId,
            userId: this.userId,
          },
        },
        data: {
          clock: {
            increment: 1,
          },
        },
      })

      return {
        ydoc,
        clock: yjsAppDoc.clock,
        byteLength: Y.encodeStateAsUpdate(ydoc).length,
      }
    }

    const yjsAppDoc = await (tx ?? prisma()).yjsAppDocument.update({
      where: { id: this.yjsAppDocumentId },
      data: {
        clock: {
          increment: 1,
        },
      },
    })

    return {
      ydoc,
      clock: yjsAppDoc.clock,
      byteLength: Y.encodeStateAsUpdate(ydoc).length,
    }
  }

  public async replaceState(newState: Buffer) {
    return acquireLock(`app:${this.yjsAppDocumentId}`, () =>
      this._replaceState(newState)
    )
  }

  private async _replaceState(newState: Buffer) {
    const ydoc = new Y.Doc()

    this.applyUpdate(ydoc, newState)

    if (this.userId) {
      const clock = await prisma().userYjsAppDocument.update({
        where: {
          yjsAppDocumentId_userId: {
            yjsAppDocumentId: this.yjsAppDocumentId,
            userId: this.userId,
          },
        },
        data: {
          state: newState,
          clock: {
            increment: 1,
          },
        },
      })

      return {
        ydoc,
        clock: clock.clock,
        byteLength: newState.length,
      }
    }

    const clock = await prisma().yjsAppDocument.update({
      where: { id: this.yjsAppDocumentId },
      data: {
        state: newState,
        clock: {
          increment: 1,
        },
      },
    })

    return {
      ydoc,
      clock: clock.clock,
      byteLength: newState.length,
    }
  }

  public canWrite(
    decoder: decoding.Decoder,
    doc: WSSharedDocV2,
    transactionOrigin: TransactionOrigin
  ) {
    const prevState = Y.encodeStateAsUpdate(doc.ydoc)
    const nextDoc = new Y.Doc()

    this.applyUpdate(nextDoc, prevState)
    readUpdate(decoding.clone(decoder), nextDoc, transactionOrigin)

    const layout = doc.layout
    const nextLayout = getLayout(nextDoc)
    const isLayoutEqual = this.isLayoutEqual(layout, nextLayout)
    if (!isLayoutEqual) {
      return false
    }

    const blocks = doc.blocks
    const nextBlocks = getBlocks(nextDoc)
    const areBlocksAcceptable = this.areBlocksAcceptable(blocks, nextBlocks)
    return areBlocksAcceptable
  }

  private async getPublishedDoc(tx: PrismaTransaction): Promise<Y.Doc> {
    const yjsAppDoc = await tx.yjsAppDocument.findFirstOrThrow({
      where: {
        id: this.yjsAppDocumentId,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    const doc = new Y.Doc()
    this.applyUpdate(doc, yjsAppDoc.state)
    return doc
  }

  private async userChangedState(
    currentDoc: WSSharedDocV2,
    tx: PrismaTransaction
  ): Promise<boolean> {
    // did the user interact with the app?
    const currentBlocks = Array.from(currentDoc.blocks.values())
    let publishedDoc: Y.Doc | null = null
    for (const block of currentBlocks) {
      const interacted = await switchBlockType(block, {
        onRichText: async () => false,
        onSQL: async () => false,
        onPython: async () => false,
        onVisualization: async () => false,
        onWriteback: async () => false,
        onFileUpload: async () => false,
        onDashboardHeader: async () => false,
        onPivotTable: async () => false,

        // interactive blocks
        onInput: async (block) => {
          publishedDoc ??= await this.getPublishedDoc(tx)

          const blockId = getBaseAttributes(block).id
          const publishedBlocks = getBlocks(publishedDoc)
          const publishedBlock = publishedBlocks.get(blockId)
          if (!publishedBlock) {
            throw new Error(`Block(${blockId}) not found in published state`)
          }
          if (!isInputBlock(publishedBlock)) {
            return true
          }

          return this.userChangedInputBlock(
            block,
            getBlocks(currentDoc.ydoc),
            publishedBlock,
            publishedBlocks
          )
        },
        onDropdownInput: async (block) => {
          publishedDoc ??= await this.getPublishedDoc(tx)

          const blockId = getBaseAttributes(block).id
          const publishedBlocks = getBlocks(publishedDoc)
          const publishedBlock = publishedBlocks.get(blockId)
          if (!publishedBlock) {
            throw new Error(`Block(${blockId}) not found in published state`)
          }

          if (!isDropdownInputBlock(publishedBlock)) {
            return true
          }

          return this.userChangedDropdownInputBlock(
            block,
            getBlocks(currentDoc.ydoc),
            publishedBlock,
            publishedBlocks
          )
        },
        onDateInput: async (block) => {
          publishedDoc ??= await this.getPublishedDoc(tx)

          const blockId = getBaseAttributes(block).id
          const publishedBlocks = getBlocks(publishedDoc)
          const publishedBlock = publishedBlocks.get(blockId)
          if (!publishedBlock) {
            throw new Error(`Block(${blockId}) not found in published state`)
          }

          if (!isDateInputBlock(publishedBlock)) {
            return true
          }

          return this.userChangedDateInputBlock(
            block,
            getBlocks(currentDoc.ydoc),
            publishedBlock,
            publishedBlocks
          )
        },
      })

      if (interacted) {
        return true
      }
    }

    return false
  }

  private async userChangedInputBlock(
    block: Y.XmlElement<InputBlock>,
    blocks: Y.Map<YBlock>,
    publishedBlock: Y.XmlElement<InputBlock>,
    publishedBlocks: Y.Map<YBlock>
  ): Promise<boolean> {
    const attrs = getInputAttributes(block, blocks)
    const publishedAttrs = getInputAttributes(publishedBlock, publishedBlocks)

    return !equals(attrs.value, publishedAttrs.value)
  }

  private async userChangedDropdownInputBlock(
    block: Y.XmlElement<DropdownInputBlock>,
    blocks: Y.Map<YBlock>,
    publishedBlock: Y.XmlElement<DropdownInputBlock>,
    publishedBlocks: Y.Map<YBlock>
  ): Promise<boolean> {
    const attrs = getDropdownInputAttributes(block, blocks)
    const publishedAttrs = getDropdownInputAttributes(
      publishedBlock,
      publishedBlocks
    )

    return !equals(attrs.value, publishedAttrs.value)
  }

  private async userChangedDateInputBlock(
    block: Y.XmlElement<DateInputBlock>,
    blocks: Y.Map<YBlock>,
    publishedBlock: Y.XmlElement<DateInputBlock>,
    publishedBlocks: Y.Map<YBlock>
  ): Promise<boolean> {
    const attrs = getDateInputAttributes(block, blocks)
    const publishedAttrs = getDateInputAttributes(
      publishedBlock,
      publishedBlocks
    )

    if (compareText(attrs.label, publishedAttrs.label) !== 0) {
      return true
    }

    if (compareText(attrs.newValue, publishedAttrs.newValue) !== 0) {
      return true
    }

    if (compareText(attrs.newVariable, publishedAttrs.newVariable) !== 0) {
      return true
    }

    // this code is written like this so that it wont compile
    // if new attributes are added.
    // that ensures that we will remember to update this
    // method when new attributes are introduced
    type ToCompare = Omit<
      DateInputBlock,
      // label is checked above
      | 'label'

      // newVariable is checked above
      | 'newVariable'

      // newValue is checked above
      | 'newValue'
    >
    const currentToCompare: ToCompare = {
      ...getBaseAttributes(block),
      status: attrs.status,
      variable: attrs.variable,
      value: attrs.value,
      executedAt: attrs.executedAt,
      configOpen: attrs.configOpen,
      dateType: attrs.dateType,
    }
    const publishedToCompare: ToCompare = {
      ...getBaseAttributes(publishedBlock),
      status: publishedAttrs.status,
      variable: publishedAttrs.variable,
      value: publishedAttrs.value,
      executedAt: publishedAttrs.executedAt,
      configOpen: publishedAttrs.configOpen,
      dateType: publishedAttrs.dateType,
    }

    return !equals(currentToCompare, publishedToCompare)
  }

  private areBlocksAcceptable(
    prevBlocks: Y.Map<YBlock>,
    nextBlocks: Y.Map<YBlock>
  ): boolean {
    if (prevBlocks.size !== nextBlocks.size) {
      return false
    }

    const nextBlockIds = new Set(nextBlocks.keys())

    for (const [prevBlockId, prevBlock] of prevBlocks) {
      const nextBlock = nextBlocks.get(prevBlockId)
      if (!nextBlock) {
        return false
      }

      const prevType = prevBlock.getAttribute('type')
      const nextType = nextBlock.getAttribute('type')
      if (prevType !== nextType) {
        return false
      }

      if (
        !this.isBlockAcceptable(prevBlock, prevBlocks, nextBlock, nextBlocks)
      ) {
        return false
      }

      nextBlockIds.delete(prevBlockId)
    }

    // a block was added
    if (nextBlockIds.size > 0) {
      return false
    }

    return true
  }

  private isBlockAcceptable(
    prevBlock: YBlock,
    prevBlocks: Y.Map<YBlock>,
    nextBlock: YBlock,
    nextBlocks: Y.Map<YBlock>
  ): boolean {
    return switchBlockType(prevBlock, {
      onRichText: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: (nextBlock) => {
            if (prevBlock.toJSON() === nextBlock.toJSON()) {
              return true
            }

            return false
          },
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onSQL: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: (nextBlock) => this.isSQLBlockAcceptable(prevBlock, nextBlock),
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onPython: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: (nextBlock) =>
            this.isPythonBlockAcceptable(prevBlock, nextBlock),
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onWriteback: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: (nextBlock) =>
            this.isWritebackBlockAcceptable(prevBlock, nextBlock),
          onPivotTable: () => false,
        })
      },
      onVisualization: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: (nextBlock) =>
            this.isVisualizationBlockAcceptable(prevBlock, nextBlock),
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onInput: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: (nextBlock) =>
            this.isInputBlockAcceptable(prevBlock, nextBlock),
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onDropdownInput: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: (nextBlock) =>
            this.isDropdownInputBlockAcceptable(prevBlock, nextBlock),
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onDateInput: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: (nextBlock) =>
            this.isDateInputBlockAcceptable(
              prevBlock,
              prevBlocks,
              nextBlock,
              nextBlocks
            ),
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onFileUpload: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: (nextBlock) =>
            this.isFileUploadBlockAcceptable(prevBlock, nextBlock),
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onDashboardHeader: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: (nextBlock) =>
            this.isDashboardHeaderBlockAcceptable(prevBlock, nextBlock),
          onWriteback: () => false,
          onPivotTable: () => false,
        })
      },
      onPivotTable: (prevBlock) => {
        return switchBlockType(nextBlock, {
          onInput: () => false,
          onDropdownInput: () => false,
          onDateInput: () => false,
          onPython: () => false,
          onRichText: () => false,
          onSQL: () => false,
          onVisualization: () => false,
          onFileUpload: () => false,
          onDashboardHeader: () => false,
          onWriteback: () => false,
          onPivotTable: (nextBlock) =>
            this.isPivotTableBlockAcceptable(prevBlock, nextBlock),
        })
      },
    })
  }

  private isSQLBlockAcceptable(
    prevBlock: Y.XmlElement<SQLBlock>,
    nextBlock: Y.XmlElement<SQLBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    if (compareText(prevAttributes.source, nextAttributes.source) !== 0) {
      return false
    }

    if (
      compareText(
        prevAttributes.editWithAIPrompt,
        nextAttributes.editWithAIPrompt
      ) !== 0
    ) {
      return false
    }

    return equals(
      omit(['status', 'source', 'editWithAIPrompt'], prevAttributes),
      omit(['status', 'source', 'editWithAIPrompt'], nextAttributes)
    )
  }

  private isPythonBlockAcceptable(
    prevBlock: Y.XmlElement<PythonBlock>,
    nextBlock: Y.XmlElement<PythonBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    if (compareText(prevAttributes.source, nextAttributes.source) !== 0) {
      return false
    }

    if (
      compareText(
        prevAttributes.editWithAIPrompt,
        nextAttributes.editWithAIPrompt
      ) !== 0
    ) {
      return false
    }

    return equals(
      omit(['status', 'source', 'editWithAIPrompt'], prevAttributes),
      omit(['status', 'source', 'editWithAIPrompt'], nextAttributes)
    )
  }

  private isVisualizationBlockAcceptable(
    prevBlock: Y.XmlElement<VisualizationBlock>,
    nextBlock: Y.XmlElement<VisualizationBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(
      omit(['status'], prevAttributes),
      omit(['status'], nextAttributes)
    )
  }

  private isInputBlockAcceptable(
    prevBlock: Y.XmlElement<InputBlock>,
    nextBlock: Y.XmlElement<InputBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(
      omit(['value'], prevAttributes),
      omit(['value'], nextAttributes)
    )
  }

  private isDropdownInputBlockAcceptable(
    prevBlock: Y.XmlElement<DropdownInputBlock>,
    nextBlock: Y.XmlElement<DropdownInputBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(
      omit(['value'], prevAttributes),
      omit(['value'], nextAttributes)
    )
  }

  private isDateInputBlockAcceptable(
    prevBlock: Y.XmlElement<DateInputBlock>,
    prevBlocks: Y.Map<YBlock>,
    nextBlock: Y.XmlElement<DateInputBlock>,
    nextBlocks: Y.Map<YBlock>
  ): boolean {
    const prevAttributes = getDateInputAttributes(prevBlock, prevBlocks)
    const nextAttributes = getDateInputAttributes(nextBlock, nextBlocks)

    // user can't change label
    if (compareText(prevAttributes.label, nextAttributes.label) !== 0) {
      return false
    }

    // user can't change variable
    if (prevAttributes.variable !== nextAttributes.variable) {
      return false
    }
    if (
      compareText(prevAttributes.newVariable, nextAttributes.newVariable) !== 0
    ) {
      return false
    }

    // user can't change timezone
    if (prevAttributes.value.timezone !== nextAttributes.value.timezone) {
      return false
    }

    // this code is written like this so that it wont compile
    // if new attributes are added.
    // that ensures that we will remember to update this
    // method when new attributes are introduced
    type ToCompare = Omit<
      DateInputBlock,
      // status is allowed to change
      | 'status'

      // label is checked above
      | 'label'

      // variable is checked above
      | 'variable'
      | 'newVariable'

      // value is checked above
      | 'value'
      // newValue is allowed to change
      | 'newValue'
    >
    const prevToCompare: ToCompare = {
      ...getBaseAttributes(prevBlock),
      executedAt: prevAttributes.executedAt,
      configOpen: prevAttributes.configOpen,
      dateType: prevAttributes.dateType,
    }
    const nextToCompare: ToCompare = {
      ...getBaseAttributes(nextBlock),
      executedAt: nextAttributes.executedAt,
      configOpen: nextAttributes.configOpen,
      dateType: nextAttributes.dateType,
    }

    return equals(prevToCompare, nextToCompare)
  }

  private isLayoutEqual(
    prevLayout: Y.Array<YBlockGroup>,
    nextLayout: Y.Array<YBlockGroup>
  ): boolean {
    if (prevLayout.length !== nextLayout.length) {
      return false
    }

    for (let i = 0; i < prevLayout.length; i++) {
      const prevGroup = prevLayout.get(i)
      const nextGroup = nextLayout.get(i)

      if (!this.isBlockGroupAcceptable(prevGroup, nextGroup)) {
        return false
      }
    }

    return true
  }

  private isBlockGroupAcceptable(
    prevGroup: YBlockGroup,
    nextGroup: YBlockGroup
  ): boolean {
    if (prevGroup.getAttribute('id') !== nextGroup.getAttribute('id')) {
      return false
    }

    const prevCurrent = prevGroup.getAttribute('current')
    const nextCurrent = nextGroup.getAttribute('current')
    if (prevCurrent?.getAttribute('id') !== nextCurrent?.getAttribute('id')) {
      return false
    }

    const prevTabs = prevGroup
      .getAttribute('tabs')
      ?.toArray()
      .map((t) => t.getAttribute('id'))
    const nextTabs = nextGroup
      .getAttribute('tabs')
      ?.toArray()
      .map((t) => t.getAttribute('id'))

    if (!equals(prevTabs, nextTabs)) {
      return false
    }

    return true
  }

  private isFileUploadBlockAcceptable(
    prevBlock: Y.XmlElement<FileUploadBlock>,
    nextBlock: Y.XmlElement<FileUploadBlock>
  ): boolean {
    return equals(prevBlock.getAttributes(), nextBlock.getAttributes())
  }

  private isDashboardHeaderBlockAcceptable(
    prevBlock: Y.XmlElement<DashboardHeaderBlock>,
    nextBlock: Y.XmlElement<DashboardHeaderBlock>
  ): boolean {
    return equals(prevBlock.getAttributes(), nextBlock.getAttributes())
  }

  private isWritebackBlockAcceptable(
    prevBlock: Y.XmlElement<WritebackBlock>,
    nextBlock: Y.XmlElement<WritebackBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    if (compareText(prevAttributes.tableName, nextAttributes.tableName) !== 0) {
      return false
    }

    return equals(
      omit(['status', 'tableName'], prevAttributes),
      omit(['status', 'tableName'], nextAttributes)
    )
  }

  private isPivotTableBlockAcceptable(
    prevBlock: Y.XmlElement<PivotTableBlock>,
    nextBlock: Y.XmlElement<PivotTableBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(
      omit(['status', 'page', 'sort'], prevAttributes),
      omit(['status', 'page', 'sort'], nextAttributes)
    )
  }
}
