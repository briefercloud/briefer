import { DatabricksSQLDataSource as PrismaDatabricksSQLDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { encrypt } from './crypto.js'

export type DatabricksSQLDataSource = Omit<
  PrismaDatabricksSQLDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'token'
  | 'structure'
  | 'dataSourceSchemaId'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toDatabricksSQLDataSource(
  pdataSource: PrismaDatabricksSQLDataSource
): DatabricksSQLDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    hostname: pdataSource.isDemo ? '' : pdataSource.hostname,
    http_path: pdataSource.isDemo ? '' : pdataSource.http_path,
    catalog: pdataSource.isDemo ? '' : pdataSource.catalog,
    schema: pdataSource.isDemo ? '' : pdataSource.schema,
    notes: pdataSource.notes,
    workspaceId: pdataSource.workspaceId,
    isDemo: pdataSource.isDemo,
    createdAt: pdataSource.createdAt.toISOString(),
    updatedAt: pdataSource.updatedAt.toISOString(),
    connStatus: pdataSource.connStatus,
    connError: pdataSource.connError,
    lastConnection: pdataSource.lastConnection?.toISOString() ?? null,
    isDefault: pdataSource.isDefault,
  }
}

export async function listDatabricksSQLDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().databricksSQLDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({
      type: 'databrickssql',
      data: toDatabricksSQLDataSource(pd),
    })
  )
}

export async function updateDatabricksSQLDataSource(
  data: Partial<Omit<PrismaDatabricksSQLDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<DatabricksSQLDataSource> {
  return prisma()
    .databricksSQLDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        token: data.token ? encrypt(data.token, encryptionKey) : undefined,
      },
    })
    .then(toDatabricksSQLDataSource)
}

export async function createDatabricksSQLDataSource(
  data: Omit<
    PrismaDatabricksSQLDataSource,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'structure'
    | 'isDemo'
    | 'dataSourceSchemaId'
  >,
  encryptionKey: string
): Promise<DatabricksSQLDataSource> {
  return prisma()
    .databricksSQLDataSource.create({
      data: {
        ...data,
        token: encrypt(data.token, encryptionKey),
      },
    })
    .then(toDatabricksSQLDataSource)
}

export async function getDatabricksSQLDataSource(
  workspaceId: string,
  id: string
): Promise<DatabricksSQLDataSource | null> {
  const fromDB = await prisma().databricksSQLDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toDatabricksSQLDataSource(fromDB)
}

export async function deleteDatabricksSQLDataSource(
  workspaceId: string,
  id: string
): Promise<DatabricksSQLDataSource> {
  return toDatabricksSQLDataSource(
    await prisma().databricksSQLDataSource.delete({
      where: { workspaceId, id },
    })
  )
}
