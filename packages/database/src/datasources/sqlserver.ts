import { SQLServerDataSource as PrismaSQLServerDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type SQLServerDataSource = Omit<
  PrismaSQLServerDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'password'
  | 'cert'
  | 'structure'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toSQLServerDataSource(
  pdataSource: PrismaSQLServerDataSource
): SQLServerDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    host: pdataSource.isDemo ? '' : pdataSource.host,
    port: pdataSource.isDemo ? '' : pdataSource.port,
    database: pdataSource.isDemo ? '' : pdataSource.database,
    username: pdataSource.isDemo ? '' : pdataSource.username,
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

export async function getSQLServerCert(
  ds: SQLServerDataSource,
  encryptionKey: string
): Promise<Buffer | null> {
  const cert = await prisma()
    .sQLServerDataSource.findUnique({
      where: { id: ds.id },
      select: { cert: true },
    })
    .then((row) => row?.cert)

  if (!cert) {
    return null
  }

  const hex = decrypt(cert, encryptionKey)
  return Buffer.from(hex, 'hex')
}

export async function getSQLServerPassword(
  ds: SQLServerDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .sQLServerDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listSQLServerDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().sQLServerDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'sqlserver', data: toSQLServerDataSource(pd) })
  )
}

export async function updateSQLServerDataSource(
  data: Partial<Omit<PrismaSQLServerDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<SQLServerDataSource> {
  return prisma()
    .sQLServerDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toSQLServerDataSource)
}

export async function createSQLServerDataSource(
  data: Omit<
    PrismaSQLServerDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<SQLServerDataSource> {
  return prisma()
    .sQLServerDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toSQLServerDataSource)
}

export async function getSQLServerDataSource(
  workspaceId: string,
  id: string
): Promise<SQLServerDataSource | null> {
  const fromDB = await prisma().sQLServerDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toSQLServerDataSource(fromDB)
}

export async function deleteSQLServerDataSource(
  workspaceId: string,
  id: string
): Promise<SQLServerDataSource> {
  return toSQLServerDataSource(
    await prisma().sQLServerDataSource.delete({ where: { workspaceId, id } })
  )
}