// https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices#solution
import { Prisma, PrismaClient } from '@prisma/client'
import { ITXClientDenyList } from '@prisma/client/runtime/library.js'
import pg from 'pg'

export type {
  Document,
  User,
  YjsDocument,
  UserWorkspace,
  YjsAppDocument,
  UserYjsAppDocument,
  YjsUpdate,
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

let connectionString: string | null = null
let singleton: PrismaClient | null = null
export const init = (_datasourceUrl: string) => {
  connectionString = _datasourceUrl
  singleton = new PrismaClient({ datasourceUrl: connectionString })
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

let pgClient: pg.Client | null = null
let subscribers: Record<string, Set<(message?: string) => void>> = {}
async function getPGClient(): Promise<pg.Client> {
  if (!connectionString) {
    throw new Error(`Access db before calling init()`)
  }

  if (pgClient) {
    return pgClient
  }

  pgClient = new pg.Client({ connectionString })
  await pgClient.connect()
  pgClient.on('notification', (notification) => {
    const subs = subscribers[notification.channel]
    if (!subs) {
      return
    }

    subs.forEach((sub) => {
      sub(notification.payload)
    })
  })

  return pgClient
}

export async function subscribe(
  channel: string,
  onNotification: (message?: string) => void
): Promise<() => Promise<void>> {
  const client = await getPGClient()
  const subs = subscribers[channel]
  if (subs) {
    subs.add(onNotification)
  } else {
    subscribers[channel] = new Set([onNotification])
    try {
      await client.query(`LISTEN ${JSON.stringify(channel)}`)
    } catch (e) {
      subscribers[channel].delete(onNotification)
      throw e
    }
  }

  return async () => {
    const subs = subscribers[channel]
    if (!subs) {
      return
    }

    if (subs.size === 1) {
      await client.query(`UNLISTEN ${JSON.stringify(channel)}`)
    }
    subs.delete(onNotification)
  }
}

export async function publish(channel: string, message: string): Promise<void> {
  const client = await getPGClient()
  await client.query('SELECT pg_notify($1, $2)', [channel, message])
}

export default prisma
