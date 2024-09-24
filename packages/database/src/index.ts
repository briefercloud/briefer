// https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices#solution
import { Prisma, PrismaClient } from '@prisma/client'
import { ITXClientDenyList } from '@prisma/client/runtime/library.js'

export type {
  Document,
  User,
  YjsDocument,
  UserWorkspace,
  YjsAppDocument,
  UserYjsAppDocument,
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
export const init = (datasourceUrl: string) => {
  singleton = new PrismaClient({ datasourceUrl })
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

export default prisma
