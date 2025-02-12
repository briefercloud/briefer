// adapted from: https://github.com/yjs/y-websocket/tree/master/bin

import { LRUCache } from 'lru-cache'
import * as Y from 'yjs'
import qs from 'querystring'
import cookie from 'cookie'
import * as http from 'http'
import { WebSocket, WebSocketServer } from 'ws'
import * as syncProtocol from 'y-protocols/sync.js'
import * as awarenessProtocol from 'y-protocols/awareness.js'

import { sessionFromCookies } from '../../auth/token.js'
import { config } from '../../config/index.js'
import prisma, {
  PrismaTransaction,
  UserWorkspaceRole,
  Document,
  ApiUser,
  getDocument,
  recoverFromNotFound,
} from '@briefer/database'
import { decoding, encoding } from 'lib0'
import { logger } from '../../logger.js'
import {
  messageYjsSyncStep1,
  messageYjsSyncStep2,
  messageYjsUpdate,
  readSyncStep1,
  readSyncStep2,
  readUpdate,
} from 'y-protocols/sync.js'
import PQueue from 'p-queue'
import { IOServer } from '../../websocket/index.js'
import { broadcastDocument } from '../../websocket/workspace/documents.js'
import {
  AppPersistor,
  DocumentPersistor,
  LoadStateResult,
  Persistor,
} from './persistors.js'
import {
  getBlocks,
  getDashboard,
  getDataframes,
  getLayout,
} from '@briefer/editor'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'
import { Executor } from './executor/index.js'
import { AIExecutor } from './executor/ai/index.js'
import { PubSubProvider } from './pubsub/index.js'
import { PGPubSub } from './pubsub/pg.js'
import pAll from 'p-all'
import { getYDocWithoutHistory } from './documents.js'

type Role = UserWorkspaceRole

export type TransactionOrigin = {
  conn: WebSocket
  user: ApiUser
  role: Role
}

async function getRequestData(req: http.IncomingMessage): Promise<{
  document: Document
  clock: number
  authUser: ApiUser
  role: Role
  isDataApp: boolean
  userId: string | null
} | null> {
  const cookiesHeader = req.headers.cookie
  const cookies = cookie.parse(cookiesHeader ?? '')
  const query = qs.parse(req.url?.split('?')[1] ?? '')
  const docId = query['documentId']
  const clock = parseInt((query['clock'] ?? '').toString())
  const isDataApp = query['isDataApp'] === 'true'
  const userId = query['userId']?.toString() ?? null

  const args = z
    .object({
      docId: uuidSchema,
      clock: z.number().refine((v) => Number.isInteger(v)),
      isDataApp: z.boolean(),
      userId: z
        .string()
        .nullable()
        .transform((v) => (v === '' ? null : v)),
    })
    .safeParse({ docId, clock, isDataApp, userId })

  if (!args.success) {
    logger().warn(
      { query },
      'Got invalid query string for y-websocket connection'
    )
    return null
  }

  const document = await prisma().document.findUnique({
    where: { id: args.data.docId },
  })

  if (!document) {
    return null
  }

  const session = await sessionFromCookies(cookies)
  if (!session) {
    return null
  }

  const uw = session.userWorkspaces[document.workspaceId]
  if (!uw) {
    return null
  }

  if (args.data.userId !== null && args.data.userId !== session.user.id) {
    return null
  }

  return {
    document,
    clock: args.data.clock,
    authUser: session.user,
    role: uw.role,
    isDataApp: args.data.isDataApp,
    userId: args.data.userId,
  }
}

export function getDocId(
  documentId: string,
  app: {
    id: string
    userId: string | null
  } | null
) {
  if (app) {
    return [documentId, app.id, String(app.userId)].join('-')
  }

  return [documentId, 'null'].join('-')
}

export function setupYJSSocketServerV2(
  server: http.Server,
  socketServer: IOServer
) {
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: 1024 * 1024 * 1024, // 1GB
  })
  wss.on('connection', setupWSConnection(socketServer))
  server.on('upgrade', async (req, socket, head) => {
    if (!req.url?.startsWith('/v2/yjs')) {
      return
    }

    const data = await getRequestData(req)
    if (!data) {
      socket.destroy()
      return
    }

    const { document, userId, authUser, role, isDataApp, clock } = data

    try {
      let ydoc: WSSharedDocV2
      if (isDataApp) {
        const yjsAppDocument = await prisma().yjsAppDocument.findFirst({
          where: {
            document: {
              id: document.id,
            },
          },
          orderBy: { createdAt: 'desc' },
        })
        if (!yjsAppDocument) {
          socket.destroy()
          return
        }

        const docId = getDocId(document.id, {
          id: yjsAppDocument.id,
          userId: userId === null ? null : authUser.id,
        })
        ydoc = await getYDoc(
          socketServer,
          docId,
          document.id,
          document.workspaceId,
          new AppPersistor(docId, yjsAppDocument.id, userId)
        )
      } else {
        const docId = getDocId(document.id, null)
        ydoc = await getYDoc(
          socketServer,
          docId,
          document.id,
          document.workspaceId,
          new DocumentPersistor(docId, document.id)
        )
      }

      // @ts-ignore
      req.briefer = {
        user: authUser,
        role,
        ydoc,
        clock,
        isDataApp,
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req)
      })
    } catch (err) {
      logger().error(
        {
          documentId: document.id,
          workspaceId: document.workspaceId,
          userId,
          err,
          isDataApp,
        },
        'Failed to setup YJS socket server'
      )
      socket.destroy()
    }
  })

  const stopCollection = startDocumentCollection()

  return {
    async shutdown() {
      const startTime = Date.now()
      try {
        logger().info('[shutdown] Shutting down YJS socket server')
        wss.close()
        stopCollection()
        while (docs.size > 0) {
          // 2 minutes
          if (Date.now() - startTime > 60 * 1000 * 2) {
            logger().error(
              { count: docs.size },
              '[shutdown] Some YJS docs did not close in time, force closing'
            )

            await pAll(
              Array.from(docs.values()).map(
                (doc) => () =>
                  doc.destroy().catch((err) => {
                    logger().error(
                      {
                        err,
                        id: doc.id,
                        workspaceId: doc.workspaceId,
                        documentId: doc.documentId,
                      },
                      '[shutdown] Failed to force close YJS doc, skipping'
                    )
                  })
              ),
              { concurrency: 5 }
            )

            logger().info(
              {
                count: docs.size,
              },
              '[shutdown] All remaining YJS docs force closed'
            )
            break
          }

          logger().info(
            { docsCount: docs.size },
            '[shutdown] Waiting for YJS docs to close'
          )
          for (const doc of docs.values()) {
            if (doc.conns.size > 0) {
              doc.conns.forEach((_, conn) => {
                closeConn(doc, conn)
              })
            } else if (doc.canCollect()) {
              await doc.destroy()
              docs.delete(doc.id)
            }
          }
          await new Promise((resolve) => setTimeout(resolve, 200))
        }

        logger().info('[shutdown] All YJS docs closed')
      } catch (err) {
        logger().error(
          { err },
          '[shutdown] Failed to shutdown YJS socket server'
        )
        throw err
      }
    },
  }
}

const wsReadyStateConnecting = 0
const wsReadyStateOpen = 1

const DOCUMENT_COLLECTION_INTERVAL = 1000 * 20 // 20 seconds
export const docs = new Map<string, WSSharedDocV2>()

export const docsCache = new LRUCache<string, WSSharedDocV2>({
  // in bytes
  maxSize: Math.max(
    Math.floor(config().YJS_DOCS_CACHE_SIZE_MB * 1024 * 1024),
    1
  ),

  sizeCalculation: (doc) => doc.getByteLength(),

  dispose: async (doc, id) => {
    if (!docs.has(id)) {
      // only destroy if the doc is not in the main map
      try {
        await doc.destroy()
      } catch (err) {
        logger().error(
          {
            id: doc.id,
            workspaceId: doc.workspaceId,
            documentId: doc.documentId,
            err,
          },
          'Failed to dispose Yjs doc after cache eviction'
        )
      }
    }
  },
})

function startDocumentCollection() {
  let timeout: NodeJS.Timeout | null = null
  let stopped = false
  async function collectDocs() {
    const start = Date.now()
    try {
      logger().trace({ docsCount: docs.size }, 'Collecting docs')
      const queue = new PQueue({ concurrency: 6 })
      let collected = 0
      for (const [docId, doc] of docs) {
        logger().trace({ docId }, 'Checking if doc can be collected')
        if (doc.canCollect()) {
          logger().trace({ docId }, 'Doc can be collected')
          docs.delete(docId)
          if (!docsCache.has(docId)) {
            // only destroy if the doc is not in cache
            await doc.destroy()
          }
          logger().trace({ docId }, 'Doc collected')
          collected++
        }
      }

      logger().trace(
        {
          size: queue.size,
        },
        'Waiting for doc collection queue to drain'
      )
      await queue.onIdle()
      logger().trace(
        { collected, timeMs: Date.now() - start },
        'Docs collected'
      )
    } catch (err) {
      logger().error(
        { err, timeMs: Date.now() - start },
        'Failed to collect docs'
      )
    }

    if (stopped) {
      return
    }

    timeout = setTimeout(collectDocs, DOCUMENT_COLLECTION_INTERVAL)
  }
  collectDocs()

  return () => {
    stopped = true
    if (timeout) {
      clearTimeout(timeout)
    }
  }
}

const messageSync = 0
const messageAwareness = 1

export class WSSharedDocV2 {
  public id: string
  public documentId: string
  public workspaceId: string
  public conns: Map<WebSocket, Set<number>>

  public ydoc: Y.Doc
  public awareness: awarenessProtocol.Awareness

  public binded: boolean = false
  public updating: number = 0
  public clock: number = 0

  public socketServer: IOServer

  private title: string = ''
  private executor: Executor
  private aiExecutor: AIExecutor
  private persistor: Persistor
  private byteLength: number = 0
  private subscription?: () => Promise<void>
  private pubSubProvider: PubSubProvider
  private hasUpdatesToPersist: boolean = false
  private persistUpdatesQueue: PQueue = new PQueue({
    concurrency: 1,
    intervalCap: 1,
    interval: 500,
  })

  private constructor(
    id: string,
    documentId: string,
    workspaceId: string,
    socketServer: IOServer,
    loadStateResult: LoadStateResult,
    persistor: Persistor
  ) {
    this.id = id
    this.documentId = documentId
    this.workspaceId = workspaceId
    this.socketServer = socketServer
    this.persistor = persistor
    this.conns = new Map()

    this.ydoc = loadStateResult.ydoc
    this.clock = loadStateResult.clock
    this.byteLength = loadStateResult.byteLength
    this.awareness = this.configAwareness()

    this.executor = Executor.fromWSSharedDocV2(this)
    this.aiExecutor = AIExecutor.fromWSSharedV2(this)

    this.pubSubProvider = new PubSubProvider(
      this.id,
      this.ydoc,
      this.clock,
      new PGPubSub(
        `yjs:${this.id}`,
        logger().child({
          id: this.id,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
        })
      ),
      this.onNewerClock,
      logger().child({
        workspaceId: this.workspaceId,
        documentId: this.documentId,
      })
    )
  }

  public async init() {
    this.ydoc.on('update', this.updateHandler)
    this.awareness.on('update', this.awarenessHandler)
    this.executor.start()
    this.aiExecutor.start()

    await this.pubSubProvider.connect()
  }

  public async replaceState(state: Buffer) {
    const result = await this.persistor.replaceState(this.clock, state)
    await this.reset(result.ydoc, result.clock, result.byteLength)
  }

  private onNewerClock = async (_newClock: number) => {
    const loadResult = await this.persistor.load()
    await this.reset(loadResult.ydoc, loadResult.clock, loadResult.byteLength)
  }

  private async reset(newYDoc: Y.Doc, newClock: number, newByteLength: number) {
    await Promise.all([this.executor.stop(), this.aiExecutor.stop()])

    this.ydoc.off('update', this.updateHandler)
    this.ydoc.destroy()

    this.awareness.off('update', this.awarenessHandler)
    await this.persistUpdatesQueue.onIdle()

    this.awareness.destroy()

    this.ydoc = newYDoc
    this.clock = newClock
    this.byteLength = newByteLength

    this.title = this.getTitleFromDoc()

    this.awareness = this.configAwareness()
    this.ydoc.on('update', this.updateHandler)
    await this.pubSubProvider.reset(newYDoc, newClock)

    this.executor = Executor.fromWSSharedDocV2(this)
    this.executor.start()

    this.aiExecutor = AIExecutor.fromWSSharedV2(this)
    this.aiExecutor.start()

    await broadcastDocument(
      this.socketServer,
      this.workspaceId,
      this.documentId
    )
  }

  private awarenessHandler = (
    {
      added,
      updated,
      removed,
    }: {
      added: Array<number>
      updated: Array<number>
      removed: Array<number>
    },
    transactionOrigin: TransactionOrigin | null
  ) => {
    const changedClients = added.concat(updated, removed)
    if (transactionOrigin !== null) {
      const connControlledIDs = this.conns.get(transactionOrigin.conn)
      if (connControlledIDs !== undefined) {
        added.forEach((clientID) => {
          connControlledIDs.add(clientID)
        })
        removed.forEach((clientID) => {
          connControlledIDs.delete(clientID)
        })
      }
    }

    // broadcast awareness update
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageAwareness)
    encoding.writeVarUint8Array(
      encoder,
      awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
    )
    const buff = encoding.toUint8Array(encoder)
    this.conns.forEach((_, c) => {
      send(this, c, buff)
    })
  }

  private configAwareness() {
    const awareness = new awarenessProtocol.Awareness(this.ydoc)
    awareness.setLocalState(null)

    return awareness
  }

  public get dashboard() {
    return getDashboard(this.ydoc)
  }

  public get dataframes() {
    return getDataframes(this.ydoc)
  }

  public get blocks() {
    return getBlocks(this.ydoc)
  }

  public get layout() {
    return getLayout(this.ydoc)
  }

  public get executionQueue() {
    return this.ydoc.getArray('executionQueue')
  }

  public async destroy() {
    await Promise.all([
      this.subscription?.(),
      this.executor.stop(),
      this.aiExecutor.stop(),
    ])

    this.ydoc.off('update', this.updateHandler)
    await this.persistUpdatesQueue.onIdle()

    await this.persistor.persist(this)
    await this.pubSubProvider.disconnect()

    this.ydoc.destroy()
  }

  private get refs() {
    return this.conns.size + this.updating
  }

  public canCollect() {
    return this.refs === 0 && this.executor.isIdle() && this.aiExecutor.isIdle()
  }

  public canWrite(
    decoder: decoding.Decoder,
    transactionOrigin: TransactionOrigin
  ) {
    return this.persistor.canWrite(decoder, this, transactionOrigin)
  }

  public getTitleFromDoc() {
    return this.ydoc.getXmlFragment('title').toJSON().slice(7, -8)
  }

  public getByteLength() {
    return this.byteLength
  }

  private updateHandler = async (
    update: Uint8Array,
    _arg1: any,
    _arg2: any,
    tr: Y.Transaction
  ) => {
    this.hasUpdatesToPersist = true

    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, messageSync)
    syncProtocol.writeUpdate(encoder, update)
    const message = encoding.toUint8Array(encoder)
    this.conns.forEach((_, conn) => send(this, conn, message))

    const titleChanged = await this.handleTitleUpdate()
    if (titleChanged) {
      try {
        await broadcastDocument(
          this.socketServer,
          this.workspaceId,
          this.documentId
        )
      } catch (err) {
        logger().error(
          { err, docId: this.documentId },
          'Failed to emit document to workspace after yjs title diff'
        )
      }
    }

    // do not persist while duplicating
    if (
      z.object({ isDuplicating: z.literal(true) }).safeParse(tr.origin).success
    ) {
      return
    }

    this.persistUpdatesQueue.add(async () => {
      this.persistUpdatesQueue.clear()
      if (this.hasUpdatesToPersist) {
        this.hasUpdatesToPersist = false
        await this.persistor.persist(this)
      }
    })
  }

  public readSyncStep1(decoder: decoding.Decoder, encoder: encoding.Encoder) {
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Reading sync step 1'
    )
    readSyncStep1(decoder, encoder, this.ydoc)
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Read sync step 1'
    )
  }

  public readSyncStep2(
    decoder: decoding.Decoder,
    transactionOrigin: TransactionOrigin
  ) {
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Reading sync step 2'
    )
    readSyncStep2(decoder, this.ydoc, transactionOrigin)
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Read sync step 2'
    )
  }

  public readUpdate(
    decoder: decoding.Decoder,
    transactionOrigin: TransactionOrigin
  ) {
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Reading Yjs update'
    )
    if (this.canWrite(decoder, transactionOrigin)) {
      readUpdate(decoder, this.ydoc, transactionOrigin)
    } else {
      logger().error(
        {
          id: this.id,
          documentId: this.documentId,
          workspaceId: this.workspaceId,
          userId: transactionOrigin.user.id,
          role: transactionOrigin.role,
        },
        'A Yjs update was unauthorized'
      )
      // disconnect the client that sent the unauthorized message
      closeConn(this, transactionOrigin.conn)
    }
    logger().trace(
      {
        id: this.id,
        documentId: this.documentId,
        workspaceId: this.workspaceId,
      },
      'Read Yjs update'
    )
  }

  private async handleTitleUpdate(): Promise<boolean> {
    const nextTitle = this.getTitleFromDoc()

    if (this.title !== nextTitle) {
      this.title = nextTitle

      try {
        logger().trace({ docId: this.documentId }, 'Updating document title')
        await recoverFromNotFound(
          prisma().document.update({
            where: {
              id: this.documentId,
            },
            data: {
              title: nextTitle,
            },
          })
        )

        return true
      } catch (err) {
        logger().error(
          { err, docId: this.documentId },
          'Failed to update document title'
        )
      }
    }

    return false
  }

  private async removeHistory() {
    const ydoc = getYDocWithoutHistory(this)
    const result = await this.persistor.replaceState(
      this.clock,
      Buffer.from(Y.encodeStateAsUpdate(ydoc))
    )
    await this.reset(result.ydoc, result.clock, result.byteLength)
  }

  public static async make(
    id: string,
    documentId: string,
    workspaceId: string,
    socketServer: IOServer,
    persistor: Persistor,
    tx?: PrismaTransaction
  ): Promise<WSSharedDocV2> {
    const loadStateResult = await persistor.load(tx)
    const doc = new WSSharedDocV2(
      id,
      documentId,
      workspaceId,
      socketServer,
      loadStateResult,
      persistor
    )
    logger().trace(
      {
        id: doc.id,
        documentId: doc.documentId,
        workspaceId: doc.workspaceId,
        applyUpdateLatency: loadStateResult.applyUpdateLatency,
        clockUpdatedAt: loadStateResult.clockUpdatedAt,
      },
      'Loadded YDoc'
    )

    if (
      loadStateResult.applyUpdateLatency > 1000 &&
      Date.now() - loadStateResult.clockUpdatedAt.getTime() >
        1000 * 60 * 60 * 24
    ) {
      // if the latency is more than 1 second and the clock was updated more than 24 hours ago
      // remove history to reduce the size of the document and improve load performance
      logger().info(
        {
          id: doc.id,
          documentId: doc.documentId,
          workspaceId: doc.workspaceId,
          applyUpdateLatency: loadStateResult.applyUpdateLatency,
          clockUpdatedAt: loadStateResult.clockUpdatedAt,
        },
        'Removing history from YDoc to reduce size and improve load performance'
      )
      await doc.removeHistory()
      logger().info(
        {
          id: doc.id,
          documentId: doc.documentId,
          workspaceId: doc.workspaceId,
        },
        'Removed history from YDoc to reduce size and improve load performance'
      )
    }

    await doc.init()

    return doc
  }
}

const creationPromises = new Map<string, Promise<WSSharedDocV2>>()
async function getYDoc(
  socketServer: IOServer,
  id: string,
  documentId: string,
  workspaceId: string,
  persistor: Persistor,
  tx?: PrismaTransaction
): Promise<WSSharedDocV2> {
  logger().trace(
    {
      id,
      documentId,
      workspaceId,
      cacheBytesSize: docsCache.calculatedSize,
      cacheCount: docsCache.size,
    },
    'Getting YDoc'
  )

  let yDoc = docs.get(id)
  if (!yDoc) {
    yDoc = docsCache.get(id)
    if (yDoc) {
      logger().trace(
        {
          id,
          documentId,
          workspaceId,
          cacheBytesSize: docsCache.calculatedSize,
          cacheCount: docsCache.size,
          hit: true,
        },
        'YDoc cache hit'
      )
      docs.set(id, yDoc)
    } else {
      logger().trace(
        {
          id,
          documentId,
          workspaceId,
          cacheBytesSize: docsCache.calculatedSize,
          cacheCount: docsCache.size,
          hit: false,
        },
        'YDoc cache miss'
      )
    }
  }

  if (!yDoc) {
    let creationPromise = creationPromises.get(id)

    if (!creationPromise) {
      creationPromise = (async () => {
        const newYDoc = await WSSharedDocV2.make(
          id,
          documentId,
          workspaceId,
          socketServer,
          persistor,
          tx
        )
        docs.set(id, newYDoc)
        docsCache.set(id, newYDoc)
        return newYDoc
      })()

      creationPromises.set(id, creationPromise)

      try {
        yDoc = await creationPromise
      } finally {
        creationPromises.delete(id)
      }
    } else {
      yDoc = await creationPromise
    }
  }

  logger().trace(
    {
      id,
      documentId,
      workspaceId,
      cacheBytesSize: docsCache.calculatedSize,
      cacheCount: docsCache.size,
    },
    'Got YDoc'
  )

  return yDoc
}

export async function getYDocForUpdate<T>(
  id: string,
  socketServer: IOServer,
  documentId: string,
  workspaceId: string,
  cb: (yDoc: WSSharedDocV2) => T,
  persistor: Persistor,
  tx?: PrismaTransaction
): Promise<T> {
  const doc = await getYDoc(
    socketServer,
    id,
    documentId,
    workspaceId,
    persistor,
    tx
  )
  doc.updating++
  try {
    const r = await cb(doc)
    doc.updating--

    logger().trace(
      {
        id,
        documentId,
        workspaceId,
        cacheBytesSize: docsCache.calculatedSize,
        cacheCount: docsCache.size,
      },
      'Got YDoc for update'
    )

    return r
  } catch (err) {
    doc.updating--
    throw err
  }
}

export const readSyncMessage = (
  decoder: decoding.Decoder,
  encoder: encoding.Encoder,
  doc: WSSharedDocV2,
  transactionOrigin: TransactionOrigin
) => {
  const messageType = decoding.readVarUint(decoder)

  switch (messageType) {
    case messageYjsSyncStep1:
      doc.readSyncStep1(decoder, encoder)
      break
    case messageYjsSyncStep2:
      doc.readSyncStep2(decoder, transactionOrigin)
      break
    case messageYjsUpdate:
      doc.readUpdate(decoder, transactionOrigin)
      break
    default: {
      const err = new Error('Unknown message type')
      throw err
    }
  }

  return messageType
}

function messageListener(
  doc: WSSharedDocV2,
  message: Uint8Array,
  transactionOrigin: TransactionOrigin
) {
  try {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message)
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case messageSync:
        encoding.writeVarUint(encoder, messageSync)
        readSyncMessage(decoder, encoder, doc, transactionOrigin)

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          const encodedMessage = encoding.toUint8Array(encoder)
          send(doc, transactionOrigin.conn, encodedMessage)
        }
        break
      case messageAwareness: {
        awarenessProtocol.applyAwarenessUpdate(
          doc.awareness,
          decoding.readVarUint8Array(decoder),
          transactionOrigin
        )
        break
      }
    }
  } catch (err) {
    logger().error(
      { err, docId: doc.documentId },
      'Failed to handle yjs message'
    )
  }
}

function closeConn(doc: WSSharedDocV2, conn: WebSocket) {
  logger().trace(
    {
      id: doc.id,
      documentId: doc.documentId,
      workspaceId: doc.workspaceId,
    },
    'Closing yjs connection'
  )

  const controlledIds = doc.conns.get(conn)
  if (controlledIds !== undefined) {
    doc.conns.delete(conn)
    awarenessProtocol.removeAwarenessStates(
      doc.awareness,
      Array.from(controlledIds),
      null
    )
  }
  conn.close()
}

function send(doc: WSSharedDocV2, conn: WebSocket, m: Uint8Array) {
  if (
    conn.readyState !== wsReadyStateConnecting &&
    conn.readyState !== wsReadyStateOpen
  ) {
    logger().trace(
      {
        id: doc.id,
        documentId: doc.documentId,
        workspaceId: doc.workspaceId,
        readyState: conn.readyState,
      },
      'Invalid connection state, closing yjs connection'
    )
    closeConn(doc, conn)
    return
  }

  try {
    conn.send(m, (err) => {
      if (!err) {
        return
      }

      closeConn(doc, conn)

      const isEPIPE = z
        .object({ code: z.literal('EPIPE') })
        .safeParse(err).success
      if (!isEPIPE) {
        // Only log if err is not EPIPE
        logger().error(
          { err, docId: doc.documentId },
          'Failed to send yjs message to client'
        )
      }
    })
  } catch (err) {
    closeConn(doc, conn)

    const isEPIPE = z
      .object({ code: z.literal('EPIPE') })
      .safeParse(err).success
    if (!isEPIPE) {
      // Only log if err is not EPIPE
      logger().error(
        { err, docId: doc.documentId },
        'Failed to send yjs message to client'
      )
    }
  }
}

const pingTimeout = 30000

const setupWSConnection =
  (socketServer: IOServer) =>
  async (conn: WebSocket, req: http.IncomingMessage) => {
    // @ts-ignore
    const briefer = req.briefer
    const ydoc: WSSharedDocV2 = briefer?.ydoc
    const role: Role = briefer?.role
    const user: ApiUser = briefer?.user
    const clock: number = briefer?.clock
    const isDataApp = briefer?.isDataApp

    if (
      !ydoc ||
      !role ||
      !user ||
      clock === undefined ||
      isDataApp === undefined
    ) {
      logger().error(
        { briefer: { ...briefer, ydoc: Boolean(ydoc) } },
        'Missing required fields'
      )
      conn.close()
      return
    }

    if (ydoc.clock !== clock) {
      logger().warn(
        {
          id: ydoc.id,
          workspaceId: ydoc.workspaceId,
          documentId: ydoc.documentId,
          userClock: clock,
          ydocClock: ydoc.clock,
          userId: user.id,
        },
        'Invalid clock'
      )

      // is the user correct?
      const doc = await getDocument(ydoc.documentId)
      if (doc && doc.workspaceId === ydoc.workspaceId) {
        const dbClock = isDataApp
          ? (doc.userAppClock[user.id] ?? doc.appClock)
          : doc.clock

        if (dbClock !== clock) {
          await broadcastDocument(
            socketServer,
            ydoc.workspaceId,
            ydoc.documentId
          )
          conn.close()
          return
        }

        // user clock is correct, fix ydoc clock
        ydoc.clock = clock
      }
    }

    ydoc.conns.set(conn, new Set())

    conn.binaryType = 'arraybuffer'

    const transactionOrigin: TransactionOrigin = {
      conn,
      user,
      role,
    }

    let lastRoleUpdate = Date.now()
    // listen and reply to events
    conn.on('message', async (message: ArrayBuffer) => {
      const now = Date.now()
      if (now - lastRoleUpdate > 5000) {
        lastRoleUpdate = now
        const uw = await prisma().userWorkspace.findFirst({
          where: {
            userId: user.id,
            workspaceId: ydoc.workspaceId,
          },
        })
        if (!uw) {
          closeConn(ydoc, conn)
          return
        }

        transactionOrigin.role = uw.role
      }

      if (clock !== ydoc.clock) {
        logger().warn(
          {
            docId: ydoc.documentId,
            userClock: clock,
            ydocClock: ydoc.clock,
          },
          'Invalid clock'
        )
        closeConn(ydoc, conn)
        return
      }

      messageListener(ydoc, new Uint8Array(message), transactionOrigin)
    })

    // Check if connection is still alive
    let pongReceived = true
    const pingInterval = setInterval(async () => {
      if (!pongReceived) {
        if (ydoc.conns.has(conn)) {
          logger().warn(
            {
              id: ydoc.id,
              workspaceId: ydoc.workspaceId,
              documentId: ydoc.documentId,
              userId: user.id,
            },
            'Client did not respond to ping'
          )
          closeConn(ydoc, conn)
        }
        clearInterval(pingInterval)
      } else if (ydoc.conns.has(conn)) {
        pongReceived = false
        try {
          logger().trace(
            {
              id: ydoc.id,
              workspaceId: ydoc.workspaceId,
              documentId: ydoc.documentId,
              userId: user.id,
              time: new Date().toISOString(),
            },
            'Pinging client'
          )
          conn.ping()
        } catch (e) {
          logger().error(
            { err: e, docId: ydoc.documentId },
            'Failed to ping client'
          )
          closeConn(ydoc, conn)
          clearInterval(pingInterval)
        }
      }
    }, pingTimeout)
    conn.on('close', async () => {
      logger().trace(
        {
          id: ydoc.id,
          workspaceId: ydoc.workspaceId,
          documentId: ydoc.documentId,
          userId: user.id,
        },
        'Client closed connection'
      )
      closeConn(ydoc, conn)
      clearInterval(pingInterval)
    })
    conn.on('pong', () => {
      logger().trace(
        {
          id: ydoc.id,
          workspaceId: ydoc.workspaceId,
          documentId: ydoc.documentId,
          userId: user.id,
          time: new Date().toISOString(),
        },
        'Received pong from client'
      )
      pongReceived = true
    })

    // put the following in variables in a block so the interval handlers don't keep it in
    // scope
    {
      // send sync step 1
      logger().trace(
        {
          id: ydoc.id,
          docId: ydoc.documentId,
          workspaceId: ydoc.workspaceId,
          userId: user.id,
        },
        'Sending sync step 1'
      )
      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, messageSync)
      syncProtocol.writeSyncStep1(encoder, ydoc.ydoc)
      send(ydoc, conn, encoding.toUint8Array(encoder))
      logger().trace(
        {
          id: ydoc.id,
          docId: ydoc.documentId,
          workspaceId: ydoc.workspaceId,
          userId: user.id,
        },
        'Sent sync step 1'
      )
      const awarenessStates = ydoc.awareness.getStates()
      if (awarenessStates.size > 0) {
        const encoder = encoding.createEncoder()
        encoding.writeVarUint(encoder, messageAwareness)
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(
            ydoc.awareness,
            Array.from(awarenessStates.keys())
          )
        )
        send(ydoc, conn, encoding.toUint8Array(encoder))
      }
    }
  }
