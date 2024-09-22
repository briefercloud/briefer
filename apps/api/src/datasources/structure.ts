import prisma, { DataSource, decrypt, encrypt } from '@briefer/database'
import * as bq from './bigquery.js'
import * as redshift from './redshift.js'
import * as psql from './psql.js'
import * as athena from './athena.js'
import * as mysql from './mysql.js'
import * as trino from './trino.js'
import * as sqlserver from './sqlserver.js'
import * as oracle from './oracle.js'
import { DataSourceStructure, jsonString } from '@briefer/types'
import { logger } from '../logger.js'
import { z } from 'zod'
import { config } from '../config/index.js'

const emptyStructure = {
  dataSourceId: '',
  schemas: {},
  defaultSchema: '',
}

export async function getStructure(
  ds: DataSource,
  forceRefresh = false
): Promise<DataSourceStructure> {
  if (forceRefresh) {
    const structure = await fetchStructure(ds)
    await saveStructure(ds, {
      structure: structure ?? emptyStructure,
      updatedAt: structure ? new Date().toISOString() : null,
      failedAt: structure ? null : new Date().toISOString(),
    })
    return structure ?? emptyStructure
  }

  const rawStructure = await getRawCache(ds)
  const cache = decryptCache(rawStructure)
  if (!cache) {
    const structure = await fetchStructure(ds)
    await saveStructure(ds, {
      structure: structure ?? emptyStructure,
      updatedAt: structure ? null : new Date().toISOString(),
      failedAt: structure ? new Date().toISOString() : null,
    })
    return structure ?? emptyStructure
  }

  if (isCacheExpired(cache)) {
    if (!isCacheFetchable(cache)) {
      // fetch failed recently, retry but do not wait
      fetchStructure(ds).then(async (structure) => {
        await saveStructure(ds, {
          structure: structure ?? cache.structure,
          updatedAt: structure ? new Date().toISOString() : null,
          failedAt: structure ? null : new Date().toISOString(),
        })
      })
      return cache.structure
    }

    // fetch failed long time ago, retry and wait
    const structure = await fetchStructure(ds)
    await saveStructure(ds, {
      structure: structure ?? cache.structure,
      updatedAt: structure ? new Date().toISOString() : null,
      failedAt: structure ? null : new Date().toISOString(),
    })

    return (
      structure ??
      // if failed again, return the old structure
      cache.structure
    )
  }

  return cache.structure
}

const StructureCache = z.object({
  updatedAt: z.string().nullable(),
  structure: DataSourceStructure,
  failedAt: z.string().nullable(),
})
type StructureCache = z.infer<typeof StructureCache>

// 1 day
const STRUCTURE_CACHE_TTL = 24 * 60 * 60 * 1000
function isCacheExpired(cache: StructureCache): boolean {
  if (!cache.updatedAt) {
    return true
  }

  return (
    new Date().getTime() - new Date(cache.updatedAt).getTime() >
    STRUCTURE_CACHE_TTL
  )
}

// 5 minutes
const RETRY_TIMEOUT = 5 * 60 * 1000
function isCacheFetchable(cache: StructureCache): boolean {
  if (!cache.failedAt) {
    return true
  }

  return (
    new Date().getTime() - new Date(cache.failedAt).getTime() > RETRY_TIMEOUT
  )
}

export function decryptCache(
  rawStructure: string | null
): StructureCache | null {
  if (!rawStructure) {
    return null
  }

  try {
    const decrypted = decrypt(rawStructure, config().DATASOURCES_ENCRYPTION_KEY)
    return jsonString.pipe(StructureCache).parse(decrypted)
  } catch (err) {
    return null
  }
}

function encryptCache(cache: StructureCache): string {
  return encrypt(JSON.stringify(cache), config().DATASOURCES_ENCRYPTION_KEY)
}

export async function getRawCache(ds: DataSource): Promise<string | null> {
  switch (ds.type) {
    case 'bigquery':
      return prisma()
        .bigQueryDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'redshift':
      return prisma()
        .redshiftDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'psql':
      return prisma()
        .postgreSQLDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'athena':
      return prisma()
        .athenaDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'oracle':
      return prisma()
        .oracleDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'mysql':
      return prisma()
        .mySQLDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'sqlserver':
      return prisma()
        .sQLServerDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
    case 'trino':
      return prisma()
        .trinoDataSource.findUnique({
          where: { id: ds.data.id },
          select: { structure: true },
        })
        .then((row) => row?.structure ?? null)
  }
}

async function fetchStructure(
  ds: DataSource
): Promise<DataSourceStructure | null> {
  try {
    switch (ds.type) {
      case 'bigquery': {
        return await bq.getSchema(ds.data)
      }
      case 'redshift': {
        return await redshift.getSchema(ds.data)
      }
      case 'psql': {
        return await psql.getSchema(ds.data)
      }
      case 'athena': {
        return await athena.getSchema(ds.data)
      }
      case 'mysql': {
        return await mysql.getSchema(ds.data)
      }
      case 'sqlserver': {
        return await sqlserver.getSchema(ds.data)
      }
      case 'trino': {
        return await trino.getSchema(ds.data)
      }
      case 'oracle': {
        return await oracle.getSchema(ds.data)
      }
    }
  } catch (err) {
    logger().error(
      {
        err,
        dataSourceId: ds.data.id,
        dataSourceType: ds.type,
      },
      'Failed to get DataSource structure'
    )

    return null
  }
}

async function saveStructure(
  ds: DataSource,
  cache: StructureCache
): Promise<null> {
  switch (ds.type) {
    case 'bigquery': {
      await prisma().bigQueryDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'redshift': {
      await prisma().redshiftDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'psql': {
      await prisma().postgreSQLDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'athena': {
      await prisma().athenaDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'oracle': {
      await prisma().oracleDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'mysql': {
      await prisma().mySQLDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'sqlserver': {
      await prisma().sQLServerDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
    case 'trino': {
      await prisma().trinoDataSource.update({
        where: { id: ds.data.id },
        data: { structure: encryptCache(cache) },
      })
      return null
    }
  }
}
