import { RedshiftDataSource as PrismaRedshiftDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type RedshiftDataSource = Omit<
  PrismaRedshiftDataSource,
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

function toRedshiftDataSource(
  pdataSource: PrismaRedshiftDataSource
): RedshiftDataSource {
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

export async function getRedshiftCert(
  ds: RedshiftDataSource,
  encryptionKey: string
): Promise<Buffer | null> {
  const cert = await prisma()
    .redshiftDataSource.findUnique({
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

export async function getRedshiftPassword(
  ds: RedshiftDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .redshiftDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listRedshiftDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().redshiftDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'redshift', data: toRedshiftDataSource(pd) })
  )
}

export async function updateRedshiftDataSource(
  data: Partial<Omit<PrismaRedshiftDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<RedshiftDataSource> {
  return prisma()
    .redshiftDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toRedshiftDataSource)
}

export async function createRedshiftDataSource(
  data: Omit<
    PrismaRedshiftDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<RedshiftDataSource> {
  return prisma()
    .redshiftDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
        cert: data.cert ? encrypt(data.cert, encryptionKey) : undefined,
      },
    })
    .then(toRedshiftDataSource)
}

export async function getRedshiftDataSource(
  workspaceId: string,
  id: string
): Promise<RedshiftDataSource | null> {
  const fromDB = await prisma().redshiftDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toRedshiftDataSource(fromDB)
}

export async function deleteRedshiftDataSource(
  id: string
): Promise<RedshiftDataSource> {
  return toRedshiftDataSource(
    await prisma().redshiftDataSource.delete({ where: { id } })
  )
}
