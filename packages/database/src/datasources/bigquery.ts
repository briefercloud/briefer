import { BigQueryDataSource as PrismaBigQueryDataSource } from '@prisma/client'

import prisma from '../index.js'
import { DataSource } from '../datasources/index.js'
import { decrypt, encrypt } from './crypto.js'

export type BigQueryDataSource = Omit<
  PrismaBigQueryDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'serviceAccountKey'
  | 'structure'
  | 'dataSourceSchemaId'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toBigQueryDataSource(
  pdataSource: PrismaBigQueryDataSource
): BigQueryDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    projectId: pdataSource.isDemo ? '' : pdataSource.projectId,
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

export async function getCredentials(
  ds: BigQueryDataSource,
  encryptionKey: string
): Promise<any> {
  const serviceAccountKey = await prisma()
    .bigQueryDataSource.findUnique({
      where: { id: ds.id },
      select: { serviceAccountKey: true },
    })
    .then((row) => row?.serviceAccountKey)

  if (!serviceAccountKey) {
    throw new Error(`Fail to fetch service account key for datasource ${ds.id}`)
  }

  return JSON.parse(decrypt(serviceAccountKey, encryptionKey))
}

export async function getBigQueryDataSource(
  workspaceId: string,
  id: string
): Promise<BigQueryDataSource | null> {
  const fromDB = await prisma().bigQueryDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toBigQueryDataSource(fromDB)
}

export async function listBigQueryDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().bigQueryDataSource.findMany({
    where: { workspaceId },
  })
  return fromDB.map(
    (bq): DataSource => ({
      type: 'bigquery',
      data: toBigQueryDataSource(bq),
    })
  )
}

export async function createBigQueryDataSource(
  data: Omit<
    PrismaBigQueryDataSource,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'structure'
    | 'isDemo'
    | 'dataSourceSchemaId'
  >,
  encryptionKey: string
): Promise<BigQueryDataSource> {
  return prisma()
    .bigQueryDataSource.create({
      data: {
        ...data,
        serviceAccountKey: encrypt(data.serviceAccountKey, encryptionKey),
      },
    })
    .then(toBigQueryDataSource)
}

export async function deleteBigQueryDataSource(
  id: string
): Promise<BigQueryDataSource | null> {
  return toBigQueryDataSource(
    await prisma().bigQueryDataSource.delete({ where: { id } })
  )
}

export async function updateBigQueryDataSource(
  data: Partial<Omit<PrismaBigQueryDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<BigQueryDataSource> {
  return prisma()
    .bigQueryDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        serviceAccountKey: data.serviceAccountKey
          ? encrypt(data.serviceAccountKey, encryptionKey)
          : undefined,
      },
    })
    .then(toBigQueryDataSource)
}
