import prisma, {
  APIDataSource,
  DataSource,
  decrypt,
  encrypt,
  getDatasource,
} from '@briefer/database'
import { IOServer } from '../websocket/index.js'
import {
  DataSourceStructure,
  DataSourceStructureState,
  dataSourceStructureStateToV2,
  DataSourceStructureStateV2,
  DataSourceTable,
  jsonString,
} from '@briefer/types'
import { config } from '../config/index.js'
import { logger } from '../logger.js'
import { getPSQLSchema } from '../python/query/psql.js'
import { broadcastDataSource } from '../websocket/workspace/data-sources.js'
import PQueue from 'p-queue'
import { getOracleSchema } from '../python/query/oracle.js'
import { getBigQuerySchema } from '../python/query/bigquery.js'
import { getTrinoSchema } from '../python/query/trino.js'
import { getAthenaSchema } from './athena.js'
import { getSqlServerSchema } from './sqlserver.js'
import { getMySQLSchema } from './mysql.js'
import { z } from 'zod'

function decryptDBData(
  dataSourceId: string,
  type: DataSource['type'],
  encrypted: string
) {
  try {
    return decrypt(encrypted, config().DATASOURCES_ENCRYPTION_KEY)
  } catch (err) {
    logger().error(
      {
        err,
        dataSourceId,
        dataSourceType: type,
      },
      'Failed to decrypt datasource structure'
    )
    return null
  }
}

async function getFromCache(
  dataSourceId: string,
  type: DataSource['type']
): Promise<DataSourceStructureStateV2 | null> {
  let encrypted: string | null
  switch (type) {
    case 'psql':
      encrypted = (
        await prisma().postgreSQLDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'mysql':
      encrypted = (
        await prisma().mySQLDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'sqlserver':
      encrypted = (
        await prisma().sQLServerDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
    case 'trino':
      encrypted = (
        await prisma().trinoDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'athena':
      encrypted = (
        await prisma().athenaDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'oracle':
      encrypted = (
        await prisma().oracleDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'redshift':
      encrypted = (
        await prisma().redshiftDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
    case 'bigquery':
      encrypted = (
        await prisma().bigQueryDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select: { structure: true },
        })
      ).structure
      break
  }

  if (encrypted === null) {
    return null
  }

  const decrypted = decryptDBData(dataSourceId, type, encrypted)
  if (decrypted === null) {
    return null
  }

  const parsed = jsonString.pipe(DataSourceStructureState).safeParse(decrypted)
  if (!parsed.success) {
    logger().error(
      {
        dataSourceId,
        dataSourceType: type,
        err: parsed.error,
      },
      'Failed to parse datasource structure from database'
    )
    return null
  }

  return dataSourceStructureStateToV2(parsed.data)
}

const TIME_TO_LIVE = 1000 * 60 * 60 * 24 // 24 hours
const PING_TIMEOUT = 1000 * 20 // 20 seconds

function isExpired(state: DataSourceStructureStateV2): boolean {
  switch (state.status) {
    case 'failed':
      return state.failedAt + TIME_TO_LIVE < Date.now()
    case 'success':
      if (state.refreshPing) {
        return state.refreshPing + PING_TIMEOUT < Date.now()
      }
      return state.updatedAt + TIME_TO_LIVE < Date.now()
    case 'loading':
      return state.loadingPing + PING_TIMEOUT < Date.now()
  }
}

// This function resolves when the data source structure is either
// cached and not expired or after it's state is set to 'loading'
// or 'refreshing'
export async function fetchDataSourceStructure(
  socketServer: IOServer,
  dsConfig: DataSource,
  { forceRefresh }: { forceRefresh: boolean }
): Promise<DataSourceStructureStateV2> {
  const currentStructure = await getFromCache(dsConfig.data.id, dsConfig.type)

  if (
    currentStructure !== null &&
    !isExpired(currentStructure) &&
    !forceRefresh
  ) {
    return currentStructure
  }

  return refreshDataSourceStructure(socketServer, dsConfig, currentStructure)
}

export type OnTable = (
  schema: string,
  tableName: string,
  table: DataSourceTable,
  defaultSchema: string
) => void

// This function resolves when the data source structure state
// is set to 'loading'. Then it proceeds to refresh the structure
// emitting the updated structure to the workspace
async function refreshDataSourceStructure(
  socketServer: IOServer,
  dsConfig: DataSource,
  currentStructure: DataSourceStructureStateV2 | null
): Promise<DataSourceStructureStateV2> {
  const dataSource: APIDataSource = await updateToLoading(
    dsConfig,
    currentStructure
  )
  await broadcastDataSource(socketServer, dataSource)

  // do not await this function, let this run in the background
  _refreshDataSourceStructure(socketServer, dataSource)

  return dataSource.structure
}

async function _refreshDataSourceStructure(
  socketServer: IOServer,
  dataSource: APIDataSource
) {
  const updateQueue = new PQueue({ concurrency: 1 })
  const onTable: OnTable = (schema, tableName, table, defaultSchema) => {
    updateQueue.add(async () => {
      switch (dataSource.structure.status) {
        case 'failed':
          return
        case 'loading':
        case 'success': {
          if (!dataSource.structure.structure) {
            dataSource.structure.structure = {
              dataSourceId: dataSource.config.data.id,
              schemas: {},
              defaultSchema,
            }
          }

          if (!dataSource.structure.structure.schemas[schema]) {
            dataSource.structure.structure.schemas[schema] = { tables: {} }
          }

          dataSource.structure.structure.schemas[schema] = {
            tables: {
              ...dataSource.structure.structure.schemas[schema].tables,
              [tableName]: table,
            },
          }
          break
        }
      }

      await broadcastDataSource(socketServer, dataSource)
    })
  }

  const interval = startPingInterval(dataSource.config)
  try {
    let finalStructure: DataSourceStructure
    switch (dataSource.config.type) {
      case 'psql':
      case 'redshift':
        finalStructure = await getPSQLSchema(
          dataSource.config.data,
          dataSource.config.type,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'oracle':
        finalStructure = await getOracleSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'athena':
        finalStructure = await getAthenaSchema(
          dataSource.config.data
          // config().DATASOURCES_ENCRYPTION_KEY,
          // onTable
        )
        break
      case 'sqlserver':
        finalStructure = await getSqlServerSchema(dataSource.config.data)
        break
      case 'trino':
        finalStructure = await getTrinoSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY
          // onTable
        )
        break
      case 'bigquery':
        finalStructure = await getBigQuerySchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'mysql':
        finalStructure = await getMySQLSchema(dataSource.config.data, onTable)
        break
    }

    await updateQueue.onIdle()
    clearInterval(interval)
    await persist({
      config: dataSource.config,
      structure: {
        status: 'success',
        updatedAt: Date.now(),
        refreshPing: null,
        structure: finalStructure,
      },
    })
    await broadcastDataSource(socketServer, dataSource)
  } catch (err) {
    clearInterval(interval)
    logger().error(
      {
        err,
        dataSourceId: dataSource.config.data.id,
        dataSourceType: dataSource.config.type,
        structureStatus: dataSource.structure.status,
      },
      'Failed to refresh datasource structure'
    )
  }
}

async function updateToLoading(
  dsConfig: DataSource,
  currentStructure: DataSourceStructureStateV2 | null
): Promise<APIDataSource> {
  let state: DataSourceStructureStateV2
  if (currentStructure !== null) {
    switch (currentStructure.status) {
      case 'failed':
        state = {
          status: 'loading',
          startedAt: Date.now(),
          loadingPing: Date.now(),
          structure: currentStructure.previousSuccess?.structure ?? null,
        }
        break
      case 'loading':
        state = {
          ...currentStructure,
          startedAt: Date.now(),
          loadingPing: Date.now(),
        }
        break
      case 'success':
        state = {
          ...currentStructure,
          refreshPing: Date.now(),
        }
        break
    }
  } else {
    state = {
      status: 'loading',
      startedAt: Date.now(),
      loadingPing: Date.now(),
      structure: null,
    }
  }

  return persist({ config: dsConfig, structure: state })
}

async function persist(ds: APIDataSource): Promise<APIDataSource> {
  const structure = encrypt(
    JSON.stringify(ds.structure),
    config().DATASOURCES_ENCRYPTION_KEY
  )

  return (async (): Promise<APIDataSource> => {
    switch (ds.config.type) {
      case 'psql':
        await prisma().postgreSQLDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'oracle':
        await prisma().oracleDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'athena':
        await prisma().athenaDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'sqlserver': {
        await prisma().sQLServerDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      }
      case 'trino':
        await prisma().trinoDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'redshift':
        await prisma().redshiftDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'bigquery':
        await prisma().bigQueryDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
      case 'mysql':
        await prisma().mySQLDataSource.update({
          where: { id: ds.config.data.id },
          data: { structure },
        })
        return ds
    }
  })()
}

function startPingInterval(dsConfig: DataSource): NodeJS.Timeout {
  return setInterval(async () => {
    const currentStructure = await getFromCache(dsConfig.data.id, dsConfig.type)
    if (!currentStructure) {
      return
    }

    switch (currentStructure.status) {
      case 'loading':
        await persist({
          config: dsConfig,
          structure: {
            ...currentStructure,
            loadingPing: Date.now(),
          },
        })
        break
      case 'success':
        if (currentStructure.refreshPing === null) {
          return
        }
        await persist({
          config: dsConfig,
          structure: {
            ...currentStructure,
            refreshPing: Date.now(),
          },
        })
    }
  }, 5000)
}

export const OnTableProgress = z.object({
  type: z.literal('progress'),
  schema: z.string(),
  tableName: z.string(),
  table: DataSourceTable,
  defaultSchema: z.string(),
})
export type OnTableProgress = z.infer<typeof OnTableProgress>
