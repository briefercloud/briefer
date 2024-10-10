import { MonetDBDataSource as PrismaMonetDBDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type MonetDBDataSource = Omit<
    PrismaMonetDBDataSource,
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

function toMonedDbDataSource(
  pdataSource: PrismaMonetDBDataSource
): MonetDBDataSource {
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

export async function getMonetDbCert(
  ds: MonetDBDataSource,
  encryptionKey: string
): Promise<Buffer | null> {
  const cert = await prisma()
    .monetDBDataSource.findUnique({
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

export async function getMonetDbPassword(
  ds: MonetDBDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .monetDBDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listMonetDbDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().monetDBDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'monetdb', data: toMonedDbDataSource(pd) })
  )
}

export async function updateMonedDbDataSource(
  data: Partial<Omit<PrismaMonetDBDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<MonetDBDataSource> {
  return prisma()
    .monetDBDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toMonedDbDataSource)
}

export async function createMonetDbDataSource(
  data: Omit<
  PrismaMonetDBDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<MonetDBDataSource> {
  return prisma()
    .monetDBDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toMonedDbDataSource)
}

export async function getMonetDbDataSource(
  workspaceId: string,
  id: string
): Promise<MonetDBDataSource | null> {
  const fromDB = await prisma().monetDBDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toMonedDbDataSource(fromDB)
}

export async function deleteMonetDbDataSource(
  workspaceId: string,
  id: string
): Promise<MonetDBDataSource> {
  return toMonedDbDataSource(
    await prisma().monetDBDataSource.delete({ where: { workspaceId, id } })
  )
}
