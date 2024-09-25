import { SnowflakeDataSource as PrismaSnowflakeDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { encrypt } from './crypto.js'

export type SnowflakeDataSource = Omit<
  PrismaSnowflakeDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'account'
  | 'password'
  | 'structure'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toSnowflakeDataSource(
  pdataSource: PrismaSnowflakeDataSource
): SnowflakeDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    user: pdataSource.user,
    warehouse: pdataSource.warehouse,
    database: pdataSource.database,
    region: pdataSource.isDemo ? '' : pdataSource.region,
    host: pdataSource.isDemo ? '' : pdataSource.host,
    notes: pdataSource.notes,
    workspaceId: pdataSource.workspaceId,
    isDemo: pdataSource.isDemo,
    createdAt: pdataSource.createdAt.toISOString(),
    updatedAt: pdataSource.updatedAt.toISOString(),
    connStatus: pdataSource.connStatus,
    connError: pdataSource.connError,
    lastConnection: pdataSource.lastConnection?.toISOString() ?? null,
  }
}

export async function listSnowflakeDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().snowflakeDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'snowflake', data: toSnowflakeDataSource(pd) })
  )
}

export async function updateSnowflakeDataSource(
  data: Partial<Omit<PrismaSnowflakeDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<SnowflakeDataSource> {
  return prisma()
    .snowflakeDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        account: data.account
          ? encrypt(data.account, encryptionKey)
          : undefined,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
      },
    })
    .then(toSnowflakeDataSource)
}

export async function createSnowflakeDataSource(
  data: Omit<
    PrismaSnowflakeDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<SnowflakeDataSource> {
  return prisma()
    .snowflakeDataSource.create({
      data: {
        ...data,
        account: encrypt(data.account, encryptionKey),
        password: encrypt(data.password, encryptionKey),
      },
    })
    .then(toSnowflakeDataSource)
}

export async function getSnowflakeDataSource(
  workspaceId: string,
  id: string
): Promise<SnowflakeDataSource | null> {
  const fromDB = await prisma().snowflakeDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toSnowflakeDataSource(fromDB)
}

export async function deleteSnowflakeDataSource(
  workspaceId: string,
  id: string
): Promise<SnowflakeDataSource> {
  return toSnowflakeDataSource(
    await prisma().snowflakeDataSource.delete({ where: { workspaceId, id } })
  )
}
