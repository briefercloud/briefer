import { PostgreSQLDataSource as PrismaPostgreSQLDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type PostgreSQLDataSource = Omit<
  PrismaPostgreSQLDataSource,
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

function toPostgreSQLDataSource(
  pdataSource: PrismaPostgreSQLDataSource
): PostgreSQLDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    host: pdataSource.isDemo ? '' : pdataSource.host,
    port: pdataSource.isDemo ? '' : pdataSource.port,
    database: pdataSource.isDemo ? '' : pdataSource.database,
    username: pdataSource.isDemo ? '' : pdataSource.username,
    notes: pdataSource.notes,
    workspaceId: pdataSource.workspaceId,
    readOnly: pdataSource.readOnly,
    isDemo: pdataSource.isDemo,
    createdAt: pdataSource.createdAt.toISOString(),
    updatedAt: pdataSource.updatedAt.toISOString(),
    connStatus: pdataSource.connStatus,
    connError: pdataSource.connError,
    lastConnection: pdataSource.lastConnection?.toISOString() ?? null,
  }
}

export async function getPSQLCert(
  ds: PostgreSQLDataSource,
  encryptionKey: string
): Promise<Buffer | null> {
  const cert = await prisma()
    .postgreSQLDataSource.findUnique({
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

export async function getPSQLPassword(
  ds: PostgreSQLDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .postgreSQLDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listPSQLDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().postgreSQLDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'psql', data: toPostgreSQLDataSource(pd) })
  )
}

export async function updatePSQLDataSource(
  data: Partial<Omit<PrismaPostgreSQLDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<PostgreSQLDataSource> {
  return prisma()
    .postgreSQLDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toPostgreSQLDataSource)
}

export async function createPSQLDataSource(
  data: Omit<
    PrismaPostgreSQLDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<PostgreSQLDataSource> {
  return prisma()
    .postgreSQLDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toPostgreSQLDataSource)
}

export async function getPSQLDataSource(
  workspaceId: string,
  id: string
): Promise<PostgreSQLDataSource | null> {
  const fromDB = await prisma().postgreSQLDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toPostgreSQLDataSource(fromDB)
}

export async function deletePSQLDataSource(
  workspaceId: string,
  id: string
): Promise<PostgreSQLDataSource> {
  return toPostgreSQLDataSource(
    await prisma().postgreSQLDataSource.delete({ where: { workspaceId, id } })
  )
}
