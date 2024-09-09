import { OracleDataSource as PrismaOracleDataSource } from '@prisma/client'

import { DataSource } from './index.js'
import prisma from '../index.js'
import { decrypt, encrypt } from './crypto.js'

export type OracleDataSource = Omit<
  PrismaOracleDataSource,
  'createdAt' | 'updatedAt' | 'lastConnection' | 'password' | 'structure'
> & {
  createdAt: string
  updatedAt: string
  lastConnection: string | null
}

function toOracleDataSource(
  pdataSource: PrismaOracleDataSource
): OracleDataSource {
  return {
    id: pdataSource.id,
    name: pdataSource.name,
    host: pdataSource.isDemo ? '' : pdataSource.host,
    port: pdataSource.isDemo ? '' : pdataSource.port,
    database: pdataSource.isDemo ? '' : pdataSource.database,
    serviceName: pdataSource.isDemo ? '' : pdataSource.serviceName,
    sid: pdataSource.isDemo ? '' : pdataSource.sid,
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

export async function getOraclePassword(
  ds: OracleDataSource,
  encryptionKey: string
): Promise<string> {
  const password = await prisma()
    .oracleDataSource.findUnique({
      where: { id: ds.id },
      select: { password: true },
    })
    .then((row) => row?.password)

  if (!password) {
    throw new Error(`Fail to fetch password for datasource ${ds.id}`)
  }

  return decrypt(password, encryptionKey)
}

export async function listOracleDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const fromDB = await prisma().oracleDataSource.findMany({
    where: { workspaceId },
  })

  return fromDB.map(
    (od): DataSource => ({ type: 'oracle', data: toOracleDataSource(od) })
  )
}

export async function updateOracleDataSource(
  data: Partial<Omit<PrismaOracleDataSource, 'createdAt' | 'updatedAt'>>,
  encryptionKey: string
): Promise<OracleDataSource> {
  return prisma()
    .oracleDataSource.update({
      where: { id: data.id },
      data: {
        ...data,
        password: data.password
          ? encrypt(data.password, encryptionKey)
          : undefined,
      },
    })
    .then(toOracleDataSource)
}

export async function createOracleDataSource(
  data: Omit<
    PrismaOracleDataSource,
    'id' | 'createdAt' | 'updatedAt' | 'structure' | 'isDemo'
  >,
  encryptionKey: string
): Promise<OracleDataSource> {
  return prisma()
    .oracleDataSource.create({
      data: {
        ...data,
        password: encrypt(data.password, encryptionKey),
      },
    })
    .then(toOracleDataSource)
}

export async function getOracleDataSource(
  workspaceId: string,
  id: string
): Promise<OracleDataSource | null> {
  const fromDB = await prisma().oracleDataSource.findUnique({
    where: { workspaceId, id },
  })
  if (!fromDB) {
    return null
  }

  return toOracleDataSource(fromDB)
}

export async function deleteOracleDataSource(
  workspaceId: string,
  id: string
): Promise<OracleDataSource> {
  return toOracleDataSource(
    await prisma().oracleDataSource.delete({ where: { workspaceId, id } })
  )
}
