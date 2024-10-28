import { AthenaDataSource as PrismaAthenaDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { encrypt } from './crypto.js'

export type AthenaDataSource = Omit<
  PrismaAthenaDataSource,
  | 'createdAt'
  | 'updatedAt'
  | 'lastConnection'
  | 'accessKeyId'
  | 'secretAccessKeyId'
  | 'structure'
  | 'dataSourceSchemaId'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toAthenaDataSource(
  pdataSource: PrismaAthenaDataSource
): AthenaDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    region: pdataSource.isDemo ? '' : pdataSource.region,
    s3OutputPath: pdataSource.isDemo ? '' : pdataSource.s3OutputPath,
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

export async function listAthenaDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().athenaDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (pd): DataSource => ({ type: 'athena', data: toAthenaDataSource(pd) })
  )
}

export async function updateAthenaDataSource(
  data: Partial<Omit<PrismaAthenaDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<AthenaDataSource> {
  return prisma()
    .athenaDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        accessKeyId: data.accessKeyId
          ? encrypt(data.accessKeyId, encryptionKey)
          : undefined,
        secretAccessKeyId: data.secretAccessKeyId
          ? encrypt(data.secretAccessKeyId, encryptionKey)
          : undefined,
      },
    })
    .then(toAthenaDataSource)
}

export async function createAthenaDataSource(
  data: Omit<
    PrismaAthenaDataSource,
    | 'id'
    | 'createdAt'
    | 'updatedAt'
    | 'structure'
    | 'isDemo'
    | 'dataSourceSchemaId'
  >,
  encryptionKey: string
): Promise<AthenaDataSource> {
  return prisma()
    .athenaDataSource.create({
      data: {
        ...data,
        accessKeyId: encrypt(data.accessKeyId, encryptionKey),
        secretAccessKeyId: encrypt(data.secretAccessKeyId, encryptionKey),
      },
    })
    .then(toAthenaDataSource)
}

export async function getAthenaDataSource(
  workspaceId: string,
  id: string
): Promise<AthenaDataSource | null> {
  const fromDB = await prisma().athenaDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toAthenaDataSource(fromDB)
}

export async function deleteAthenaDataSource(
  workspaceId: string,
  id: string
): Promise<AthenaDataSource> {
  return toAthenaDataSource(
    await prisma().athenaDataSource.delete({ where: { workspaceId, id } })
  )
}
