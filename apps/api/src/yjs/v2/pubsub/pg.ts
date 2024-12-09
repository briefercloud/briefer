import pino from 'pino'
import { IPubSub, MessageYProtocol } from './index.js'
import prisma, { publish, subscribe } from '@briefer/database'
import { z } from 'zod'
import { jsonString, uuidSchema } from '@briefer/types'

const PGMessage = MessageYProtocol.omit({ data: true }).extend({
  channel: z.string(),
  payloadId: uuidSchema,
})
type PGMessage = z.infer<typeof PGMessage>

export class PGPubSub implements IPubSub {
  constructor(
    private readonly channel: string,
    private readonly logger: pino.Logger
  ) {}

  public async publish(message: MessageYProtocol): Promise<void> {
    const payload = await prisma().pubSubPayload.create({
      data: {
        payload: Buffer.from(message.data),
      },
      select: { id: true },
    })

    const pgMessage: PGMessage = {
      id: message.id,
      channel: this.channel,
      senderId: message.senderId,
      targetId: message.targetId,
      clock: message.clock,
      payloadId: payload.id,
    }
    await publish(this.pgChannel(), JSON.stringify(pgMessage))
  }

  public async subscribe(
    callback: (message: MessageYProtocol) => void
  ): Promise<() => Promise<void>> {
    this.logger.trace(
      {
        channel: this.channel,
        pgChannel: this.pgChannel(),
      },
      'Subscribing to channel'
    )
    const cleanup = await subscribe(this.pgChannel(), async (message) => {
      if (!message) {
        this.logger.error(
          {
            channel: this.channel,
            pgChannel: this.pgChannel(),
          },
          'Received empty message'
        )
        return
      }

      const parsed = jsonString.pipe(PGMessage).safeParse(message)
      if (!parsed.success) {
        this.logger.error(
          {
            channel: this.channel,
            pgChannel: this.pgChannel(),
            message,
            err: parsed.error,
          },
          'Failed to parse message'
        )
        return
      }

      // since pg channel has a max length, we can't be sure that we wont have collisions
      if (parsed.data.channel !== this.channel) {
        return
      }

      const dbData = await prisma().pubSubPayload.findUnique({
        where: {
          id: parsed.data.payloadId,
        },
      })
      if (!dbData) {
        this.logger.error(
          {
            channel: this.channel,
            pgChannel: this.pgChannel(),
            payloadId: parsed.data.payloadId,
          },
          'Could not find pubsub payload in database'
        )
        return
      }

      const yjsMessage: MessageYProtocol = {
        id: parsed.data.id,
        data: dbData.payload,
        senderId: parsed.data.senderId,
        targetId: parsed.data.targetId,
        clock: parsed.data.clock,
      }
      callback(yjsMessage)
    })
    this.logger.trace(
      {
        channel: this.channel,
        pgChannel: this.pgChannel(),
      },
      'Subscribed to channel'
    )
    return cleanup
  }

  private pgChannel(): string {
    // max postgres channel length is 63
    return this.channel.slice(0, 63)
  }
}
