import pAll from 'p-all'
import * as Y from 'yjs'
import * as syncProtocol from 'y-protocols/sync.js'
import { v4 as uuidv4 } from 'uuid'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'
import { decoding, encoding } from 'lib0'
import pino from 'pino'
import PQueue from 'p-queue'

export interface IPubSub {
  publish(message: MessageYProtocol): Promise<void>
  subscribe(
    callback: (message: MessageYProtocol) => void
  ): Promise<() => Promise<void>>
}

const syncProtocolMessageType = 0
const awarenessProtocolMessageType = 1
const pingProtocolMessageType = 2
const pongProtocolMessageType = 3
const PING_TIMEOUT = 30 * 1000 // 30 seconds
const RESYNC_INTERVAL = 30 * 1000 // 30 seconds

export const MessageYProtocol = z.object({
  id: z.string(),
  data: z.instanceof(Uint8Array),
  senderId: uuidSchema,
  targetId: z.union([z.literal('broadcast'), uuidSchema]),
  clock: z.number(),
})
export type MessageYProtocol = z.infer<typeof MessageYProtocol>

export class PubSubProvider {
  private pubsubId = uuidv4()
  private subscription: (() => Promise<void>) | null = null
  private syncedPeers = new Map<string, { waitingPong: boolean }>()
  private resyncInterval: NodeJS.Timeout | null = null
  private pingInterval: NodeJS.Timeout | null = null
  private updateHandlerQueue: PQueue = new PQueue({ concurrency: 1 })
  private pendingUpdates: { update: Uint8Array; origin: any }[] = []

  constructor(
    private readonly id: string,
    private ydoc: Y.Doc,
    private clock: number,
    private readonly pubsub: IPubSub,
    private readonly onNewerClock: (clock: number) => Promise<void>,
    private readonly logger: pino.Logger
  ) {}

  public getSyncedPeers() {
    return this.syncedPeers
  }

  public async connect() {
    if (this.subscription) {
      this.logger.warn(
        {
          id: this.id,
        },
        'Called connect but already connected'
      )
      return
    }

    this.subscription = await this.pubsub.subscribe(this.onSubMessage)

    await this.sendSync1('broadcast')

    this.ydoc.on('update', this.updateHandler)

    this.resyncInterval = setInterval(() => {
      this.sendSync1('broadcast')
    }, RESYNC_INTERVAL)

    this.pingInterval = setTimeout(this.onPingInterval, PING_TIMEOUT)
  }

  public async disconnect() {
    if (!this.subscription) {
      this.logger.warn(
        {
          id: this.id,
        },
        'Called disconnect but already disconnected'
      )
      return
    }

    if (this.resyncInterval) {
      clearInterval(this.resyncInterval)
      this.resyncInterval = null
    }

    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }

    this.ydoc.off('update', this.updateHandler)
    await this.updateHandlerQueue.onIdle()

    await this.subscription()
    this.subscription = null
  }

  public async reset(newYdoc: Y.Doc, newClock: number) {
    await this.disconnect()
    this.ydoc = newYdoc
    this.clock = newClock
    this.syncedPeers = new Map()
    await this.connect()
  }

  private onPingInterval = async () => {
    for (const [peer, { waitingPong }] of this.syncedPeers) {
      if (waitingPong) {
        this.logger.trace(
          {
            id: this.id,
            peer,
          },
          'Peer did not respond to ping in time, removing peer.'
        )
        this.syncedPeers.delete(peer)
      }
    }
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, pingProtocolMessageType)
    const data = encoding.toUint8Array(encoder)
    await pAll(
      Array.from(this.syncedPeers.keys()).map((peer) => async () => {
        await this.pubsub.publish({
          id: this.id,
          data,
          clock: this.clock,
          senderId: this.pubsubId,
          targetId: peer,
        })
        this.logger.trace(
          {
            id: this.id,
            pubsubId: this.pubsubId,
            peer,
          },
          'Sent ping message to peer'
        )
        this.syncedPeers.set(peer, { waitingPong: true })
      }),
      {
        concurrency: 5,
      }
    )

    this.pingInterval = setTimeout(this.onPingInterval, PING_TIMEOUT)
  }

  private updateHandler = async (update: Uint8Array, origin: any) => {
    this.pendingUpdates.push({ update, origin })

    await this.updateHandlerQueue.add(async () => {
      const updates = this.pendingUpdates
      this.pendingUpdates = []

      if (updates.length === 0) {
        return
      }

      const isAllOwnUpdates = updates.every(({ origin }) => origin === this)
      if (isAllOwnUpdates) {
        this.logger.trace(
          {
            id: this.id,
            pubsubId: this.pubsubId,
          },
          'Ignoring own updates'
        )
        return
      }

      const update = Y.mergeUpdates(updates.map(({ update }) => update))

      const encoder = encoding.createEncoder()
      encoding.writeVarUint(encoder, syncProtocolMessageType)
      syncProtocol.writeUpdate(encoder, update)
      const data = encoding.toUint8Array(encoder)

      await pAll(
        Array.from(this.syncedPeers.keys()).map((peer) => async () => {
          const message: MessageYProtocol = {
            id: this.id,
            data,
            clock: this.clock,
            senderId: this.pubsubId,
            targetId: peer,
          }
          await this.pubsub.publish(message)
        }),
        {
          concurrency: 5,
        }
      )
    })
  }

  private async sendSync1(targetId: string) {
    const encoder = encoding.createEncoder()
    encoding.writeVarUint(encoder, syncProtocolMessageType)
    syncProtocol.writeSyncStep1(encoder, this.ydoc)

    const data = encoding.toUint8Array(encoder)
    const message: MessageYProtocol = {
      id: this.id,
      data,
      clock: this.clock,
      senderId: this.pubsubId,
      targetId,
    }
    await this.pubsub.publish(message)
    this.logger.trace(
      {
        id: this.id,
        targetId,
      },
      'Sent sync1 message'
    )
  }

  private onSubMessage = async (message: MessageYProtocol) => {
    if (message.id !== this.id) {
      this.logger.trace(
        {
          thisId: this.id,
          messageId: message.id,
          messageType: this.getMessageType(message.data),
        },
        'Ignoring sub message for different doc'
      )
      return
    }

    if (message.senderId === this.pubsubId) {
      this.logger.trace(
        {
          id: this.id,
          messageType: this.getMessageType(message.data),
        },
        'Ignoring own sub message'
      )
      return
    }

    if (
      message.targetId !== 'broadcast' &&
      message.targetId !== this.pubsubId
    ) {
      this.logger.trace(
        {
          id: this.id,
          messangeSenderId: message.senderId,
          messageTargetId: message.targetId,
          thisSenderId: this.pubsubId,
          messageType: this.getMessageType(message.data),
        },
        'Ignoring y-protocol message for different target'
      )
      return
    }

    if (message.clock < this.clock) {
      this.logger.trace(
        {
          id: this.id,
          senderId: message.senderId,
          targetId: message.targetId,
          clock: message.clock,
          thisClock: this.clock,
          messageType: this.getMessageType(message.data),
        },
        'Ignoring message with old clock'
      )
      return
    }

    if (message.clock > this.clock) {
      this.logger.trace(
        {
          id: this.id,
          senderId: message.senderId,
          targetId: message.targetId,
          clock: message.clock,
          thisClock: this.clock,
          messageType: this.getMessageType(message.data),
        },
        'Got a message with a newer clock'
      )
      await this.onNewerClock(message.clock)
      return
    }
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageType: this.getMessageType(message.data),
      },
      'Handling foreign sub message'
    )

    await this.handleMessage(message)
  }

  private async handleMessage(message: MessageYProtocol) {
    const encoder = encoding.createEncoder()
    const decoder = decoding.createDecoder(message.data)
    const protocolType = decoding.readVarUint(decoder)
    switch (protocolType) {
      case syncProtocolMessageType: {
        encoding.writeVarUint(encoder, syncProtocolMessageType)
        this.readSyncMessage(message, decoder, encoder, this)

        // If the `encoder` only contains the type of reply message and no
        // message, there is no need to send the message. When `encoder` only
        // contains the type of reply, its length is 1.
        if (encoding.length(encoder) > 1) {
          const encodedMessage = encoding.toUint8Array(encoder)
          const replyMessage: MessageYProtocol = {
            id: this.id,
            data: encodedMessage,
            clock: this.clock,
            senderId: this.pubsubId,
            targetId: message.senderId,
          }
          await this.pubsub.publish(replyMessage)
          this.logger.trace(
            {
              id: this.id,
            },
            'Sent reply message'
          )
        }
        break
      }
      case awarenessProtocolMessageType:
        this.logger.error(
          {
            id: this.id,
            senderId: message.senderId,
            targetId: message.targetId,
          },
          'Received awareness message, but awareness messages are not supported yet.'
        )
        break
      case pingProtocolMessageType: {
        this.readPingMessage(message, encoder)
        break
      }
      case pongProtocolMessageType: {
        this.readPongMessage(message)
        break
      }
      default: {
        this.logger.error(
          {
            id: this.id,
            protocolType,
          },
          'Received unknown protocol type'
        )
        break
      }
    }
  }

  private readSyncMessage(
    message: MessageYProtocol,
    decoder: decoding.Decoder,
    encoder: encoding.Encoder,
    transactionOrigin: any
  ): number {
    const messageType = decoding.readVarUint(decoder)
    switch (messageType) {
      case syncProtocol.messageYjsSyncStep1:
        this.readSyncStep1(message, decoder, encoder)
        break
      case syncProtocol.messageYjsSyncStep2:
        this.readSyncStep2(message, decoder, transactionOrigin)
        break
      case syncProtocol.messageYjsUpdate:
        this.readUpdate(message, decoder, transactionOrigin)
        break
      default:
        this.logger.error(
          {
            id: this.id,
            senderId: message.senderId,
            targetId: message.targetId,
            messageSize: message.data.length,
            messageType,
          },
          'Received unknown message type'
        )
    }
    return messageType
  }

  private readSyncStep1(
    message: MessageYProtocol,
    decoder: decoding.Decoder,
    encoder: encoding.Encoder
  ) {
    this.syncedPeers.set(message.senderId, { waitingPong: false })
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageSize: message.data.length,
        messageType: 'syncStep1',
      },
      'Reading sync1 message'
    )
    syncProtocol.readSyncStep1(decoder, encoder, this.ydoc)
  }

  private readSyncStep2(
    message: MessageYProtocol,
    decoder: decoding.Decoder,
    transactionOrigin: any
  ) {
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageSize: message.data.length,
        messageType: 'syncStep2',
      },
      'Reading sync2 message'
    )
    syncProtocol.readSyncStep2(decoder, this.ydoc, transactionOrigin)
    this.syncedPeers.set(message.senderId, { waitingPong: false })
  }

  private readUpdate(
    message: MessageYProtocol,
    decoder: decoding.Decoder,
    transactionOrigin: any
  ) {
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageSize: message.data.length,
        messageType: 'update',
      },
      'Reading update message'
    )
    syncProtocol.readUpdate(decoder, this.ydoc, transactionOrigin)
  }

  private async readPingMessage(
    message: MessageYProtocol,
    encoder: encoding.Encoder
  ) {
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageSize: message.data.length,
        messageType: 'ping',
      },
      'Reading ping message'
    )
    encoding.writeVarUint(encoder, pongProtocolMessageType)
    await this.pubsub.publish({
      id: this.id,
      data: encoding.toUint8Array(encoder),
      clock: this.clock,
      senderId: this.pubsubId,
      targetId: message.senderId,
    })
  }

  private async readPongMessage(message: MessageYProtocol) {
    this.logger.trace(
      {
        id: this.id,
        senderId: message.senderId,
        targetId: message.targetId,
        messageSize: message.data.length,
        messageType: 'pong',
      },
      'Reading pong message from peer'
    )
    if (this.syncedPeers.has(message.senderId)) {
      this.syncedPeers.set(message.senderId, { waitingPong: false })
    }
  }

  private getMessageType(data: Uint8Array): string {
    if (data.length === 0) {
      return 'unknown'
    }

    const decoder = decoding.createDecoder(data)

    const first = decoding.readVarUint(decoder)
    switch (first) {
      case syncProtocolMessageType:
        if (decoder.pos >= decoder.arr.length) {
          return 'sync-missingSecond'
        }

        const second = decoding.peekVarUint(decoder)
        switch (second) {
          case syncProtocol.messageYjsSyncStep1:
            return 'sync-syncStep1'
          case syncProtocol.messageYjsSyncStep2:
            return 'sync-syncStep2'
          case syncProtocol.messageYjsUpdate:
            return 'sync-update'
          default:
            return 'sync-unknown'
        }
      case awarenessProtocolMessageType:
        return 'awareness'
      case pingProtocolMessageType:
        return 'ping'
      case pongProtocolMessageType:
        return 'pong'
      default:
        return 'unknown'
    }
  }
}
