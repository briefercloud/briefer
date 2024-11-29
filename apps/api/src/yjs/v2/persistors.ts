import * as Y from 'yjs'
import prisma, {
  PrismaTransaction,
  UserYjsAppDocument,
  YjsAppDocument,
} from '@briefer/database'
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
  DropdownInputBlock,
  DateInputBlock,
  getDateInputAttributes,
  PivotTableBlock,
} from '@briefer/editor'
import { equals, omit } from 'ramda'
import { uuidv4 } from 'lib0/random.js'
import { WritebackBlock } from '@briefer/editor/types/blocks/writeback.js'
import { acquireLock } from '../../lock.js'

export type LoadStateResult = {
  ydoc: Y.Doc
  clock: number
  byteLength: number
}
export interface Persistor {
  load: (id: string, tx?: PrismaTransaction) => Promise<LoadStateResult>
  persistUpdate: (ydoc: WSSharedDocV2, update: Uint8Array) => Promise<string>
  canWrite: (
    decoder: decoding.Decoder,
    doc: WSSharedDocV2,
    transactionOrigin: TransactionOrigin
  ) => boolean
  replaceState: (id: string, newState: Buffer) => Promise<LoadStateResult>
}

export class DocumentPersistor implements Persistor {
  constructor(private readonly documentId: string) {}

  private applyUpdate(ydoc: Y.Doc, update: Buffer | Uint8Array) {
    Y.applyUpdate(ydoc, update)
  }

  public async load(id: string, tx?: PrismaTransaction) {
    try {
      return acquireLock(`document-persistor:${id}`, async () => {
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

        const update = await (tx ?? prisma()).yjsUpdate.findFirst({
          where: {
            yjsDocumentId: dbDoc.id,
            clock: dbDoc.clock,
          },
          select: { update: true },
          orderBy: { createdAt: 'desc' },
        })
        if (update) {
          this.applyUpdate(ydoc, update.update)
        }

        const updatesCount = await (tx ?? prisma()).yjsUpdate.count({
          where: {
            yjsDocumentId: dbDoc.id,
            clock: { lte: dbDoc.clock },
          },
        })

        if (updatesCount > 100) {
          logger().trace(
            {
              id,
              documentId: this.documentId,
              clock: dbDoc.clock,
              updates: updatesCount,
            },
            'Too many updates, cleaning up'
          )
          const cleanUpdates = async (tx: PrismaTransaction) => {
            const deleted = await tx.yjsUpdate.deleteMany({
              where: {
                yjsDocumentId: dbDoc.id,
                clock: { lte: dbDoc.clock },
              },
            })

            await tx.yjsUpdate.create({
              data: {
                yjsDocumentId: dbDoc.id,
                update: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
                clock: dbDoc.clock,
              },
            })

            return deleted.count
          }

          let deleted = 0
          if (tx) {
            deleted = await cleanUpdates(tx)
          } else {
            deleted = await prisma().$transaction(cleanUpdates)
          }

          logger().trace(
            {
              id,
              documentId: this.documentId,
              clock: dbDoc.clock,
              updates: updatesCount,
              deleted,
            },
            'Finished cleaning up updates'
          )
        }

        return {
          ydoc,
          clock: dbDoc.clock,
          byteLength: dbDoc.state.length,
        }
      })
    } catch (err) {
      logger().error(
        { documentId: this.documentId, err },
        'Failed to load Yjs document state'
      )
      throw err
    }
  }

  public async persistUpdate(doc: WSSharedDocV2, update: Uint8Array) {
    return acquireLock(`document-persistor:${doc.id}`, async () => {
      let yjsDoc = await prisma().yjsDocument.findUnique({
        select: { id: true, clock: true },
        where: { documentId: this.documentId },
      })
      const isNew = !yjsDoc
      if (!yjsDoc) {
        yjsDoc = await prisma().yjsDocument.upsert({
          where: { documentId: this.documentId },
          create: {
            documentId: this.documentId,
            state: Buffer.from(Y.encodeStateAsUpdate(doc.ydoc)),
          },
          update: {},
          select: { id: true, clock: true },
        })
      }

      if (!isNew) {
        const updatesCount = await prisma().yjsUpdate.count({
          where: {
            yjsDocumentId: yjsDoc.id,
          },
        })

        if (updatesCount > 100) {
          logger().trace(
            {
              documentId: this.documentId,
              clock: yjsDoc.clock,
              updates: updatesCount,
            },
            'Too many updates, cleaning up'
          )
          await prisma().yjsUpdate.deleteMany({
            where: {
              OR: [
                { yjsDocumentId: yjsDoc.id },
                { clock: { lt: yjsDoc.clock } },
              ],
            },
          })
          logger().trace(
            {
              documentId: this.documentId,
              clock: yjsDoc.clock,
              updates: updatesCount,
            },
            'Finished cleaning up updates'
          )
        }
      }

      const { id } = await prisma().yjsUpdate.create({
        data: {
          yjsDocumentId: yjsDoc.id,
          update: Buffer.from(update),
          clock: yjsDoc.clock,
        },
        select: { id: true },
      })

      return id
    })
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

  public async replaceState(id: string, newState: Buffer) {
    return acquireLock(`document-persistor:${id}`, async () => {
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
    })
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

  public async load(id: string, tx?: PrismaTransaction | undefined) {
    try {
      return acquireLock(`app-persistor:${id}`, async () => {
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

          const cleanUpdates = async (
            ydoc: Y.Doc,
            doc:
              | { _tag: 'user'; userYjsAppDocument: UserYjsAppDocument }
              | { _tag: 'app'; yjsAppDocument: YjsAppDocument },
            tx: PrismaTransaction
          ) => {
            const where =
              doc._tag === 'user'
                ? {
                    userYjsAppDocumentUserId: doc.userYjsAppDocument.userId,
                    userYjsAppDocumentYjsAppDocumentId:
                      doc.userYjsAppDocument.yjsAppDocumentId,
                  }
                : { yjsAppDocumentId: doc.yjsAppDocument.id }
            const deleted = await tx.yjsUpdate.deleteMany({
              where: {
                ...where,
                clock: {
                  lt:
                    doc._tag === 'user'
                      ? doc.userYjsAppDocument.clock
                      : doc.yjsAppDocument.clock,
                },
              },
            })
            if (doc._tag === 'user') {
              await tx.yjsUpdate.create({
                data: {
                  userYjsAppDocumentUserId: doc.userYjsAppDocument.userId,
                  userYjsAppDocumentYjsAppDocumentId:
                    doc.userYjsAppDocument.yjsAppDocumentId,
                  update: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
                  clock: doc.userYjsAppDocument.clock,
                },
              })
            } else {
              await tx.yjsUpdate.create({
                data: {
                  yjsAppDocumentId: doc.yjsAppDocument.id,
                  update: Buffer.from(Y.encodeStateAsUpdate(ydoc)),
                  clock: doc.yjsAppDocument.clock,
                },
              })
            }

            return deleted.count
          }

          const ydoc = new Y.Doc()
          const userYjsAppDoc = yjsAppDoc.userYjsAppDocuments[0]
          let byteLength = userYjsAppDoc?.state.length ?? yjsAppDoc.state.length
          let clock = userYjsAppDoc?.clock ?? yjsAppDoc.clock
          if (!userYjsAppDoc || !this.userId) {
            // no user or user never opened the app before. bind to the published state

            const update = await tx.yjsUpdate.findFirst({
              where: {
                yjsAppDocumentId: this.yjsAppDocumentId,
                clock: yjsAppDoc.clock,
              },
              select: { update: true },
              orderBy: { createdAt: 'desc' },
            })

            this.applyUpdate(ydoc, yjsAppDoc.state)
            if (update) {
              this.applyUpdate(ydoc, update.update)
            }

            const updatesCount = await tx.yjsUpdate.count({
              where: {
                yjsAppDocumentId: this.yjsAppDocumentId,
                clock: { lte: yjsAppDoc.clock },
              },
            })
            if (updatesCount > 100) {
              logger().trace(
                {
                  id,
                  yjsAppDocumentId: this.yjsAppDocumentId,
                  userId: this.userId,
                  clock: yjsAppDoc.clock,
                  updates: updatesCount,
                },
                'Too many updates, cleaning up'
              )
              const deleted = await cleanUpdates(
                ydoc,
                { _tag: 'app', yjsAppDocument: yjsAppDoc },
                tx
              )
              logger().trace(
                {
                  id,
                  yjsAppDocumentId: this.yjsAppDocumentId,
                  userId: this.userId,
                  clock: yjsAppDoc.clock,
                  updates: updatesCount,
                  deleted,
                },
                'Finished cleaning up updates'
              )
            }
          } else {
            // bind to the user's state
            const update = await tx.yjsUpdate.findFirst({
              where: {
                userYjsAppDocumentUserId: this.userId,
                userYjsAppDocumentYjsAppDocumentId: this.yjsAppDocumentId,
                clock: userYjsAppDoc.clock,
              },
              select: { update: true },
              orderBy: { createdAt: 'desc' },
            })

            this.applyUpdate(ydoc, userYjsAppDoc.state)
            if (update) {
              this.applyUpdate(ydoc, update.update)
            }

            const updatesCount = await tx.yjsUpdate.count({
              where: {
                userYjsAppDocumentUserId: this.userId,
                userYjsAppDocumentYjsAppDocumentId: this.yjsAppDocumentId,
                clock: { lte: userYjsAppDoc.clock },
              },
            })

            if (updatesCount > 100) {
              logger().trace(
                {
                  id,
                  yjsAppDocumentId: this.yjsAppDocumentId,
                  userId: this.userId,
                  clock: userYjsAppDoc.clock,
                  updates: updatesCount,
                },
                'Too many updates, cleaning up'
              )
              const deleted = await cleanUpdates(
                ydoc,
                { _tag: 'user', userYjsAppDocument: userYjsAppDoc },
                tx
              )
              logger().trace(
                {
                  id,
                  yjsAppDocumentId: this.yjsAppDocumentId,
                  userId: this.userId,
                  clock: userYjsAppDoc.clock,
                  updates: updatesCount,
                  deleted,
                },
                'Finished cleaning up updates'
              )
            }
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
      })
    } catch (err) {
      logger().error(
        { yjsAppDocumentId: this.yjsAppDocumentId, userId: this.userId, err },
        'Failed to load Yjs app document state'
      )
      throw err
    }
  }

  public async persistUpdate(doc: WSSharedDocV2, update: Uint8Array) {
    return acquireLock(`app-persistor:${doc.id}`, async () => {
      if (this.userId) {
        await prisma().userYjsAppDocument.upsert({
          where: {
            yjsAppDocumentId_userId: {
              yjsAppDocumentId: this.yjsAppDocumentId,
              userId: this.userId,
            },
          },
          create: {
            yjsAppDocumentId: this.yjsAppDocumentId,
            userId: this.userId,
            state: Buffer.from(Y.encodeStateAsUpdate(doc.ydoc)),
            clock: doc.clock,
          },
          update: {},
        })

        const updatesCount = await prisma().yjsUpdate.count({
          where: {
            userYjsAppDocumentUserId: this.userId,
            userYjsAppDocumentYjsAppDocumentId: this.yjsAppDocumentId,
          },
        })
        if (updatesCount > 100) {
          logger().trace(
            {
              yjsAppDocumentId: this.yjsAppDocumentId,
              userId: this.userId,
              clock: doc.clock,
              updates: updatesCount,
            },
            'Too many updates, cleaning up'
          )
          await prisma().yjsUpdate.deleteMany({
            where: {
              userYjsAppDocumentUserId: this.userId,
              userYjsAppDocumentYjsAppDocumentId: this.yjsAppDocumentId,
            },
          })
          logger().trace(
            {
              yjsAppDocumentId: this.yjsAppDocumentId,
              userId: this.userId,
              clock: doc.clock,
              updates: updatesCount,
            },
            'Finished cleaning up updates'
          )
        }

        const { id } = await prisma().yjsUpdate.create({
          data: {
            userYjsAppDocumentUserId: this.userId,
            userYjsAppDocumentYjsAppDocumentId: this.yjsAppDocumentId,
            update: Buffer.from(update),
            clock: doc.clock,
          },
          select: { id: true },
        })
        return id
      }

      const updatesCount = await prisma().yjsUpdate.count({
        where: {
          yjsAppDocumentId: this.yjsAppDocumentId,
        },
      })
      if (updatesCount > 100) {
        logger().trace(
          {
            yjsAppDocumentId: this.yjsAppDocumentId,
            clock: doc.clock,
            updates: updatesCount,
          },
          'Too many updates, cleaning up'
        )
        await prisma().yjsUpdate.deleteMany({
          where: {
            yjsAppDocumentId: this.yjsAppDocumentId,
          },
        })
        logger().trace(
          {
            yjsAppDocumentId: this.yjsAppDocumentId,
            clock: doc.clock,
            updates: updatesCount,
          },
          'Finished cleaning up updates'
        )
      }

      const { id } = await prisma().yjsUpdate.create({
        data: {
          yjsAppDocumentId: this.yjsAppDocumentId,
          update: Buffer.from(update),
          clock: doc.clock,
        },
        select: { id: true },
      })
      return id
    })
  }

  public async replaceState(id: string, newState: Buffer) {
    return acquireLock(`app-persistor:${id}`, async () => {
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
    })
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
      omit(['source', 'editWithAIPrompt'], prevAttributes),
      omit(['source', 'editWithAIPrompt'], nextAttributes)
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
      omit(['source', 'editWithAIPrompt'], prevAttributes),
      omit(['source', 'editWithAIPrompt'], nextAttributes)
    )
  }

  private isVisualizationBlockAcceptable(
    prevBlock: Y.XmlElement<VisualizationBlock>,
    nextBlock: Y.XmlElement<VisualizationBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(prevAttributes, nextAttributes)
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

      // value is allowed to change
      | 'value'
      // newValue is allowed to change
      | 'newValue'
    >
    const prevToCompare: ToCompare = {
      ...getBaseAttributes(prevBlock),
      executedAt: prevAttributes.executedAt,
      configOpen: prevAttributes.configOpen,
      dateType: prevAttributes.dateType,
      error: prevAttributes.error,
    }
    const nextToCompare: ToCompare = {
      ...getBaseAttributes(nextBlock),
      executedAt: nextAttributes.executedAt,
      configOpen: nextAttributes.configOpen,
      dateType: nextAttributes.dateType,
      error: nextAttributes.error,
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
      omit(['tableName'], prevAttributes),
      omit(['tableName'], nextAttributes)
    )
  }

  private isPivotTableBlockAcceptable(
    prevBlock: Y.XmlElement<PivotTableBlock>,
    nextBlock: Y.XmlElement<PivotTableBlock>
  ): boolean {
    const prevAttributes = prevBlock.getAttributes()
    const nextAttributes = nextBlock.getAttributes()

    return equals(
      omit(['page', 'sort'], prevAttributes),
      omit(['page', 'sort'], nextAttributes)
    )
  }
}
