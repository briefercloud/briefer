import { TrinoDataSource as PrismaTrinoDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type TrinoDataSource = Omit<
  PrismaTrinoDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'password'
  | 'structure'
  | 'dataSourceSchemaId'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toTrinoDataSource(
  pdataSource: PrismaTrinoDataSource
): TrinoDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    host: pdataSource.host,
    port: pdataSource.port,
    catalog: pdataSource.catalog,
    username: pdataSource.username,
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

export async function getTrinoPassword(
  ds: TrinoDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .trinoDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listTrinoDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().trinoDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'trino', data: toTrinoDataSource(pd) })
  )
}

export async function updateTrinoDataSource(
  data: Partial<Omit<PrismaTrinoDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<TrinoDataSource> {
  return prisma()
    .trinoDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
      },
    })
    .then(toTrinoDataSource)
}

export async function createTrinoDataSource(
  data: Omit<
    PrismaTrinoDataSource,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'structure'
    | 'isDemo'
    | 'dataSourceSchemaId'
  >,
  encryptionKey: string
): Promise<TrinoDataSource> {
  return prisma()
    .trinoDataSource.create({
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : data.password,
      },
    })
    .then(toTrinoDataSource)
}

export async function getTrinoDataSource(
  workspaceId: string,
  id: string
): Promise<TrinoDataSource | null> {
  const fromDB = await prisma().trinoDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toTrinoDataSource(fromDB)
}

export async function deleteTrinoDataSource(
  workspaceId: string,
  id: string
): Promise<TrinoDataSource> {
  return toTrinoDataSource(
    await prisma().trinoDataSource.delete({ where: { workspaceId, id } })
  )
}
