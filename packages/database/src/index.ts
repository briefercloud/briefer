// https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices#solution
import { Prisma, PrismaClient } from '@prisma/client'
import { ITXClientDenyList } from '@prisma/client/runtime/library.js'
import PQueue from 'p-queue'
import pg from 'pg'
import { z } from 'zod'

export type {
  Document,
  User,
  YjsDocument,
  UserWorkspace,
  YjsAppDocument,
  UserYjsAppDocument,
  YjsUpdate,
  ReusableComponentInstance,
  OnboardingTutorial,
} from '@prisma/client'

export { UserWorkspaceRole } from '@prisma/client'

// TODO move these to their own package
export { encrypt, decrypt } from './datasources/crypto.js'

export * from './documents.js'
export * from './schedule.js'
export * from './datasources/index.js'
export * from './users.js'
export * from './workspaces.js'
export * from './environments.js'
export * from './components.js'

export type PrismaTransaction = Omit<PrismaClient, ITXClientDenyList>

let singleton: PrismaClient | null = null

export type InitOptions = {
  connectionString: string
  ssl:
    | 'prefer'
    | {
        rejectUnauthorized: boolean | undefined
        ca: string | undefined
      }
    | false
}
let dbOptions: InitOptions | null = null

export const init = (initOptions: InitOptions) => {
  dbOptions = initOptions
  singleton = new PrismaClient({ datasourceUrl: dbOptions.connectionString })
}

export const prisma = () => {
  if (!singleton) {
    throw new Error(`Access prisma before calling init()`)
  }

  return singleton
}

export async function recoverFromNotFound<A>(
  promise: Promise<A>
): Promise<A | null> {
  try {
    return await promise
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === 'P2025') {
        return null
      }
    }
    throw e
  }
}

let pubSubClient: pg.Client | null = null
const getPubSubClientQueue = new PQueue({ concurrency: 1 })
async function getPubSubClient(dbOptions: InitOptions): Promise<pg.Client> {
  if (pubSubClient) {
    return pubSubClient
  }

  const result = await getPubSubClientQueue.add(async () => {
    if (pubSubClient) {
      return pubSubClient
    }

    let connectionString = dbOptions.connectionString

    const ssl =
      dbOptions.ssl === 'prefer'
        ? undefined
        : dbOptions.ssl
          ? {
              rejectUnauthorized: dbOptions.ssl.rejectUnauthorized ?? undefined,
              ca: dbOptions.ssl.ca ?? undefined,
            }
          : false

    pubSubClient = new pg.Client({
      connectionString,
      ssl,
    })

    try {
      await pubSubClient.connect()
    } catch (err) {
      if (
        dbOptions.ssl === 'prefer' &&
        err instanceof Error &&
        err.message === 'The server does not support SSL connections'
      ) {
        pubSubClient = new pg.Client({
          connectionString: dbOptions.connectionString,
          ssl: false,
        })
        await pubSubClient.connect()
      } else {
        throw err
      }
    }

    pubSubClient.on('notification', (notification) => {
      const subs = subscribers[notification.channel]
      if (!subs) {
        return
      }

      subs.forEach((sub) => {
        sub(notification.payload)
      })
    })

    pubSubClient.on('error', (err) => {
      console.error('Got an error from the PG pubSubClient', err)
      reconnectPubSub({ retryForever: true })
    })

    return pubSubClient
  })
  if (!result) {
    throw new Error('Getting pubSubClient returned void')
  }

  return result
}

let pgPool: pg.Pool | null = null
export async function getPGPool(dbOptions: InitOptions): Promise<pg.Pool> {
  if (pgPool) {
    return pgPool
  }

  let connectionString = dbOptions.connectionString

  const ssl =
    dbOptions.ssl === 'prefer'
      ? undefined
      : dbOptions.ssl
        ? {
            rejectUnauthorized: dbOptions.ssl.rejectUnauthorized ?? undefined,
            ca: dbOptions.ssl.ca ?? undefined,
          }
        : false

  pgPool = new pg.Pool({
    connectionString,
    ssl,
  })

  try {
    await pgPool.connect()
  } catch (err) {
    if (
      dbOptions.ssl === 'prefer' &&
      err instanceof Error &&
      err.message === 'The server does not support SSL connections'
    ) {
      pgPool = new pg.Pool({
        connectionString: dbOptions.connectionString,
        ssl: false,
      })
      await pgPool.connect()
    } else {
      throw err
    }
  }

  return pgPool
}

export async function getPGInstance(): Promise<{
  pubSubClient: pg.Client
  pool: pg.Pool
}> {
  if (!dbOptions) {
    throw new Error(`Access db before calling init()`)
  }

  if (pubSubClient && pgPool) {
    return { pubSubClient, pool: pgPool }
  }

  const [newPubSubClient, newPgPool] = await Promise.all([
    getPubSubClient(dbOptions),
    getPGPool(dbOptions),
  ])

  return { pubSubClient: newPubSubClient, pool: newPgPool }
}

let reconnectingToPubSub = false
async function reconnectPubSub({ retryForever }: { retryForever: boolean }) {
  if (!dbOptions) {
    throw new Error(
      'Unable to reconnect to PG PubSub because dbOptions is not set'
    )
  }

  if (reconnectingToPubSub) {
    console.log('[reconnecting] Already reconnecting to PG PubSub')
    return
  }

  reconnectingToPubSub = true
  console.log('[reconnecting] Reconnecting to PG PubSub')

  // we must keep retrying while there are still subscribers
  while (Object.keys(subscribers).length > 0) {
    try {
      if (pubSubClient) {
        console.log('[reconnecting] Closing pubSubClient before reconnecting')
        await pubSubClient.end()
      }

      pubSubClient = null
      pubSubClient = await getPubSubClient(dbOptions)
      // re-subscribe to all channels
      for (const channel of Object.keys(subscribers)) {
        await pubSubClient.query(`LISTEN ${JSON.stringify(channel)}`)
      }
      console.log('[reconnecting] Reconnected to PG PubSub successfully')
      break
    } catch (err) {
      console.error('[reconnecting] Error reconnecting to PG:', err)
      if (!retryForever) {
        console.error(
          '[reconnecting] Not retrying because retryForever is false'
        )
        break
      }

      console.error('[reconnecting] Retrying in 1 second')

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  reconnectingToPubSub = false
}

const subscribers: Record<string, Set<(message?: string) => void>> = {}
const subscribeQueues: Record<string, PQueue> = {}

function getSubscribeQueueForChannel(channel: string): PQueue {
  if (!subscribeQueues[channel]) {
    subscribeQueues[channel] = new PQueue({ concurrency: 1 })
  }

  return subscribeQueues[channel]
}

export async function subscribe(
  channel: string,
  onNotification: (message?: string) => void
): Promise<() => Promise<void>> {
  const queue = getSubscribeQueueForChannel(channel)

  // This ensures only one `LISTEN` setup happens at a time for this channel
  await queue.add(async () => {
    let retryOnNotConnected = true
    while (true) {
      const { pubSubClient } = await getPGInstance()

      const subs = subscribers[channel]
      if (subs) {
        subs.add(onNotification)
        return
      }

      subscribers[channel] = new Set([onNotification])

      try {
        await pubSubClient.query(`LISTEN ${JSON.stringify(channel)}`)
        break
      } catch (err) {
        if (
          retryOnNotConnected &&
          z.object({ message: z.literal('Not connected') }).safeParse(err)
            .success
        ) {
          // try reconnecting and then retry once
          await reconnectPubSub({ retryForever: false })
          retryOnNotConnected = false
        } else {
          subscribers[channel].delete(onNotification)
          throw err
        }
      }
    }
  })

  return async () => {
    // This prevents race conditions when multiple unsubscribe operations or a subscribe and unsubscribe overlap
    await queue.add(async () => {
      const { pubSubClient } = await getPGInstance()
      const subs = subscribers[channel]
      if (!subs) {
        return
      }

      subs.delete(onNotification)

      if (subs.size === 0) {
        // If this was the last subscriber, clean up by removing the channel and issuing UNLISTEN
        await pubSubClient.query(`UNLISTEN ${JSON.stringify(channel)}`)
        delete subscribers[channel]
        delete subscribeQueues[channel]
      }
    })
  }
}

export async function publish(channel: string, message: string): Promise<void> {
  let retryOnNotConnected = true

  while (true) {
    const { pubSubClient } = await getPGInstance()
    try {
      await pubSubClient.query('SELECT pg_notify($1, $2)', [channel, message])
      break
    } catch (err) {
      if (
        retryOnNotConnected &&
        z.object({ message: z.literal('Not connected') }).safeParse(err).success
      ) {
        // try reconnecting and then retry once
        await reconnectPubSub({ retryForever: false })
        retryOnNotConnected = false
      } else {
        throw err
      }
    }
  }
}

export default prisma
