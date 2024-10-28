import { MySQLDataSource as PrismaMySQLDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type MySQLDataSource = Omit<
  PrismaMySQLDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'password'
  | 'cert'
  | 'structure'
  | 'dataSourceSchemaId'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toMySQLDataSource(
  pdataSource: PrismaMySQLDataSource
): MySQLDataSource {
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

export async function getMySQLCert(
  ds: MySQLDataSource,
  encryptionKey: string
): Promise<Buffer | null> {
  const cert = await prisma()
    .mySQLDataSource.findUnique({
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

export async function getMySQLPassword(
  ds: MySQLDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .mySQLDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listMySQLDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().mySQLDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'mysql', data: toMySQLDataSource(pd) })
  )
}

export async function updateMySQLDataSource(
  data: Partial<Omit<PrismaMySQLDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<MySQLDataSource> {
  return prisma()
    .mySQLDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toMySQLDataSource)
}

export async function createMySQLDataSource(
  data: Omit<
    PrismaMySQLDataSource,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'structure'
    | 'isDemo'
    | 'dataSourceSchemaId'
  >,
  encryptionKey: string
): Promise<MySQLDataSource> {
  return prisma()
    .mySQLDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toMySQLDataSource)
}

export async function getMySQLDataSource(
  workspaceId: string,
  id: string
): Promise<MySQLDataSource | null> {
  const fromDB = await prisma().mySQLDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toMySQLDataSource(fromDB)
}

export async function deleteMySQLDataSource(
  workspaceId: string,
  id: string
): Promise<MySQLDataSource> {
  return toMySQLDataSource(
    await prisma().mySQLDataSource.delete({ where: { workspaceId, id } })
  )
}
