import prisma, {
  APIDataSource,
  DataSource,
  DataSourceSchema as DBDataSourceSchema,
  decrypt,
  getWorkspaceWithSecrets,
} from '@briefer/database'
import { IOServer } from '../websocket/index.js'
import {
  DataSourceColumn,
  DataSourceStructureError,
  DataSourceStructureStateV3,
  DataSourceTable,
  parseOrElse,
} from '@briefer/types'
import { config } from '../config/index.js'
import { logger } from '../logger.js'
import { getPSQLSchema } from '../python/query/psql.js'
import {
  broadcastDataSource,
  broadcastDataSourceSchemaTableRemoved,
  broadcastDataSourceSchemaTableUpdate,
} from '../websocket/workspace/data-sources.js'
import PQueue from 'p-queue'
import { getOracleSchema } from '../python/query/oracle.js'
import { getBigQuerySchema } from '../python/query/bigquery.js'
import { getTrinoSchema } from '../python/query/trino.js'
import { getSnowflakeSchema } from '../python/query/snowflake.js'
import { getAthenaSchema } from './athena.js'
import { getMySQLSchema } from './mysql.js'
import { getDatabricksSQLSchema } from '../python/query/databrickssql.js'
import { PythonExecutionError } from '../python/index.js'
import { z } from 'zod'
import { splitEvery } from 'ramda'
import { createEmbedding } from '../embedding.js'
import { getSQLServerSchema } from '../python/query/sqlserver.js'

async function assignDataSourceSchemaId(
  dataSourceId: string,
  type: DataSource['type'],
  dbSchema: DBDataSourceSchema
): Promise<string> {
  switch (type) {
    case 'psql':
      await prisma().postgreSQLDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'mysql':
      await prisma().mySQLDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'sqlserver':
      await prisma().sQLServerDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'trino':
      await prisma().trinoDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'athena':
      await prisma().athenaDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'oracle':
      await prisma().oracleDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'redshift':
      await prisma().redshiftDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'bigquery':
      await prisma().bigQueryDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'snowflake':
      await prisma().snowflakeDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
    case 'databrickssql':
      await prisma().databricksSQLDataSource.update({
        where: { id: dataSourceId },
        data: { dataSourceSchemaId: dbSchema.id },
      })
      return dbSchema.id
  }
}

export async function fetchDataSourceStructureFromCache(
  dataSourceId: string,
  type: DataSource['type']
): Promise<DataSourceStructureStateV3 | null> {
  const select = {
    dataSourceSchema: true,
  }
  let schema: DBDataSourceSchema | null
  switch (type) {
    case 'psql':
      schema = (
        await prisma().postgreSQLDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'mysql':
      schema = (
        await prisma().mySQLDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'sqlserver':
      schema = (
        await prisma().sQLServerDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'trino':
      schema = (
        await prisma().trinoDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'athena':
      schema = (
        await prisma().athenaDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'oracle':
      schema = (
        await prisma().oracleDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'redshift':
      schema = (
        await prisma().redshiftDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'bigquery':
      schema = (
        await prisma().bigQueryDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'snowflake':
      schema = (
        await prisma().snowflakeDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
    case 'databrickssql':
      schema = (
        await prisma().databricksSQLDataSource.findUniqueOrThrow({
          where: { id: dataSourceId },
          select,
        })
      ).dataSourceSchema
      break
  }

  if (schema === null) {
    return null
  }

  switch (schema.status) {
    case 'loading': {
      if (!schema.startedAt || !schema.refreshPing) {
        return null
      }

      return {
        id: schema.id,
        status: 'loading',
        startedAt: schema.startedAt.getTime(),
        loadingPing: schema.refreshPing.getTime(),
        additionalContext: schema.additionalInfo,
        version: 3,
      }
    }
    case 'failed': {
      if (!schema.failedAt) {
        return null
      }
      const error = parseOrElse(DataSourceStructureError, schema.error, {
        type: 'unknown',
        message: JSON.stringify(schema.error),
      })

      return {
        id: schema.id,
        status: 'failed',
        failedAt: schema.failedAt.getTime(),
        previousSuccessAt: schema.finishedAt?.getTime() ?? null,
        error,
        defaultSchema: schema.defaultSchema,
        additionalContext: schema.additionalInfo,
        version: 3,
      }
    }
    case 'success': {
      if (!schema.finishedAt || schema.defaultSchema === null) {
        return null
      }

      return {
        id: schema.id,
        status: 'success',
        updatedAt: schema.finishedAt.getTime(),
        refreshPing: schema.refreshPing?.getTime() ?? null,
        defaultSchema: schema.defaultSchema,
        additionalContext: schema.additionalInfo,
        version: 3,
      }
    }
  }
}

const TIME_TO_LIVE = 1000 * 60 * 60 * 24 // 24 hours
const PING_TIMEOUT = 1000 * 20 // 20 seconds

function isExpired(state: DataSourceStructureStateV3): boolean {
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
  {
    forceRefresh,
    additionalInfo,
  }: { forceRefresh: boolean; additionalInfo?: string | null }
): Promise<DataSourceStructureStateV3> {
  let structure = await fetchDataSourceStructureFromCache(
    dsConfig.data.id,
    dsConfig.type
  )

  if (structure === null || isExpired(structure) || forceRefresh) {
    structure = await refreshDataSourceStructure(
      socketServer,
      dsConfig,
      structure
    )
  }

  if (additionalInfo !== undefined) {
    await prisma().dataSourceSchema.update({
      where: { id: structure.id },
      data: { additionalInfo },
    })
    structure.additionalContext = additionalInfo
  }

  return structure
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
  currentStructure: DataSourceStructureStateV3 | null
): Promise<DataSourceStructureStateV3> {
  const dataSource: APIDataSource = await updateToLoading(
    dsConfig,
    currentStructure
  )
  broadcastDataSource(socketServer, dataSource)

  // do not await this function, let this run in the background
  _refreshDataSourceStructure(socketServer, dataSource)

  return dataSource.structure
}

async function _refreshDataSourceStructure(
  socketServer: IOServer,
  dataSource: APIDataSource
) {
  const workspace = await getWorkspaceWithSecrets(
    dataSource.config.data.workspaceId
  )
  if (!workspace) {
    throw new Error(
      `Failed to find Workspace(${dataSource.config.data.workspaceId}) for DataSource(${dataSource.config.data.id})`
    )
  }

  let openAiApiKey = workspace.secrets?.openAiApiKey ?? null
  if (openAiApiKey) {
    openAiApiKey = decrypt(
      openAiApiKey,
      config().WORKSPACE_SECRETS_ENCRYPTION_KEY
    )
  } else {
    openAiApiKey = config().OPENAI_API_KEY
  }

  const updateQueue = new PQueue({ concurrency: 1 })
  const tables: { schema: string; table: string }[] = []
  let defaultSchema = ''
  const onTable: OnTable = (schema, tableName, table, newDefaultSchema) => {
    defaultSchema = newDefaultSchema || schema
    tables.push({ schema, table: tableName })
    updateQueue.add(async () => {
      const embeddingResults: { embedding: number[]; model: string }[] = []
      let columnsSplits = []
      let current: typeof table.columns | undefined = table.columns
      while (current) {
        try {
          let ddl = `CREATE TABLE ${schema}.${tableName} (\n`
          for (const c of current) {
            ddl += `  ${c.name} ${c.type}\n`
          }

          logger().trace(
            {
              workspaceId: dataSource.config.data.workspaceId,
              schema,
              tableName,
              ddlCount: ddl.length,
            },
            'Creating embedding'
          )
          const embeddingResult = await createEmbedding(ddl, openAiApiKey)
          if (embeddingResult) {
            embeddingResults.push(embeddingResult)
          }
        } catch (err) {
          if (
            z
              .object({
                message: z
                  .string()
                  .refine((m) => m.includes('maximum context length')),
              })
              .safeParse(err).success
          ) {
            logger().trace(
              {
                workspaceId: dataSource.config.data.workspaceId,
                schema,
                tableName,
                err,
              },
              'Failed to create embedding due to maximum context length. Splitting columns'
            )

            const first = current.slice(0, current.length / 2)
            columnsSplits.push(first)

            const second = current.slice(current.length / 2)
            columnsSplits.push(second)
          } else {
            logger().error(
              {
                err,
                dataSourceId: dataSource.config.data.id,
                dataSourceType: dataSource.config.type,
                schemaName: schema,
                tableName,
              },
              'Failed to create embedding'
            )
          }
        }

        current = columnsSplits.shift()
      }

      await prisma().dataSourceSchema.update({
        where: { id: dataSource.structure.id },
        data: { defaultSchema },
      })

      const dbSchemaTable = await prisma().dataSourceSchemaTable.upsert({
        where: {
          dataSourceSchemaId_schema_name: {
            dataSourceSchemaId: dataSource.structure.id,
            schema: schema,
            name: tableName,
          },
        },
        create: {
          schema,
          name: tableName,
          columns: table.columns,
          dataSourceSchemaId: dataSource.structure.id,
          embeddingModel: '',
        },
        update: {
          columns: table.columns,
        },
      })

      if (embeddingResults.length > 0) {
        await prisma().$transaction(async (tr) => {
          tr.dataSourceSchemaTableEmbeddings.deleteMany({
            where: {
              dataSourceSchemaTableId: dbSchemaTable.id,
            },
          })

          for (const result of embeddingResults) {
            await tr.$queryRaw`INSERT INTO "DataSourceSchemaTableEmbeddings" ("dataSourceSchemaTableId", embedding, "embeddingModel") VALUES (${dbSchemaTable.id}::uuid, ${result.embedding}::vector, ${result.model})`
          }
        })
      }

      broadcastDataSource(socketServer, dataSource)
      broadcastDataSourceSchemaTableUpdate(
        socketServer,
        dataSource.config.data.workspaceId,
        dataSource.config.data.id,
        schema,
        tableName,
        table
      )
    })
  }

  const interval = startPingInterval(dataSource.config)
  try {
    switch (dataSource.config.type) {
      case 'psql':
      case 'redshift':
        await getPSQLSchema(
          dataSource.config.data,
          dataSource.config.type,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'oracle':
        await getOracleSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'athena':
        await getAthenaSchema(dataSource.config.data, onTable)
        break
      case 'sqlserver':
        await getSQLServerSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'trino':
        await getTrinoSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'bigquery':
        await getBigQuerySchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'mysql':
        await getMySQLSchema(dataSource.config.data, onTable)
        break
      case 'snowflake':
        await getSnowflakeSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
      case 'databrickssql':
        await getDatabricksSQLSchema(
          dataSource.config.data,
          config().DATASOURCES_ENCRYPTION_KEY,
          onTable
        )
        break
    }

    await updateQueue.onIdle()
    clearInterval(interval)
    dataSource.structure = await persist({
      id: dataSource.structure.id,
      status: 'success',
      updatedAt: Date.now(),
      refreshPing: null,
      defaultSchema,
      additionalContext: dataSource.structure.additionalContext,
      version: 3,
    })

    const allTables = await prisma().dataSourceSchemaTable.findMany({
      where: {
        dataSourceSchemaId: dataSource.structure.id,
      },
      select: { id: true, schema: true, name: true },
    })

    // Filter out tables that are in the `tables` list
    const tablesToDelete = allTables.filter(
      (table) =>
        !tables.some((t) => t.schema === table.schema && t.table === table.name)
    )

    for (const batch of splitEvery(100, tablesToDelete)) {
      await prisma().dataSourceSchemaTable.deleteMany({
        where: {
          id: { in: batch.map((t) => t.id) },
        },
      })
      for (const table of tablesToDelete) {
        broadcastDataSourceSchemaTableRemoved(
          socketServer,
          dataSource.config.data.workspaceId,
          dataSource.config.data.id,
          table.schema,
          table.name
        )
      }
    }

    broadcastDataSource(socketServer, dataSource)
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
    let error: DataSourceStructureError
    if (err instanceof PythonExecutionError) {
      error = err.toPythonErrorOutput()
    } else if (err instanceof Error) {
      error = { type: 'unknown', message: err.message }
    } else {
      error = { type: 'unknown', message: String(err ?? 'Unknown error') }
    }

    dataSource.structure = await persist({
      id: dataSource.structure.id,
      status: 'failed',
      failedAt: Date.now(),
      previousSuccessAt:
        dataSource.structure.status === 'success'
          ? dataSource.structure.updatedAt
          : null,
      error,
      additionalContext: dataSource.structure.additionalContext,
      defaultSchema:
        'defaultSchema' in dataSource.structure
          ? dataSource.structure.defaultSchema
          : null,
      version: 3,
    })
    broadcastDataSource(socketServer, dataSource)
  }
}

async function updateToLoading(
  dsConfig: DataSource,
  currentStructure: DataSourceStructureStateV3 | null
): Promise<APIDataSource> {
  if (currentStructure === null) {
    const now = new Date()
    const schema = await prisma().dataSourceSchema.create({
      data: {
        status: 'loading',
        startedAt: now,
        refreshPing: now,
      },
    })
    await assignDataSourceSchemaId(dsConfig.data.id, dsConfig.type, schema)
    return {
      config: dsConfig,
      structure: {
        id: schema.id,
        status: 'loading',
        startedAt: now.getTime(),
        loadingPing: now.getTime(),
        additionalContext: null,
        version: 3,
      },
    }
  }

  let state: DataSourceStructureStateV3
  switch (currentStructure.status) {
    case 'failed':
      state = {
        id: currentStructure.id,
        status: 'loading',
        startedAt: Date.now(),
        loadingPing: Date.now(),
        additionalContext: currentStructure.additionalContext,
        version: 3,
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

  return {
    config: dsConfig,
    structure: await persist(state),
  }
}

async function persist(
  state: DataSourceStructureStateV3
): Promise<DataSourceStructureStateV3> {
  switch (state.status) {
    case 'loading':
      await prisma().dataSourceSchema.update({
        where: { id: state.id },
        data: {
          status: state.status,
          startedAt: new Date(state.startedAt),
          refreshPing: new Date(state.loadingPing),
        },
      })
      return state
    case 'failed':
      await prisma().dataSourceSchema.update({
        where: { id: state.id },
        data: {
          status: state.status,
          failedAt: new Date(state.failedAt),
          error: state.error,
        },
      })
      return state
    case 'success':
      await prisma().dataSourceSchema.update({
        where: { id: state.id },
        data: {
          status: state.status,
          finishedAt: new Date(state.updatedAt),
          refreshPing: state.refreshPing ? new Date(state.refreshPing) : null,
          defaultSchema: state.defaultSchema,
        },
      })
      return state
  }
}

function startPingInterval(dsConfig: DataSource): NodeJS.Timeout {
  return setInterval(async () => {
    const currentStructure = await fetchDataSourceStructureFromCache(
      dsConfig.data.id,
      dsConfig.type
    )
    if (!currentStructure) {
      return
    }

    switch (currentStructure.status) {
      case 'loading':
        await prisma().dataSourceSchema.update({
          where: { id: currentStructure.id },
          data: { refreshPing: new Date() },
        })
        break
      case 'success':
        if (currentStructure.refreshPing === null) {
          return
        }
        await prisma().dataSourceSchema.update({
          where: { id: currentStructure.id },
          data: { refreshPing: new Date() },
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

export type SchemaTableItem = {
  schemaName: string
  tableName: string
  dataSourceId: string
  table: DataSourceTable
}
export async function* listSchemaTables(
  dataSources: APIDataSource[]
): AsyncGenerator<SchemaTableItem> {
  const schemaToDataSourceId = new Map(
    dataSources.map((d) => [d.structure.id, d.config.data.id])
  )
  const schemaIds = dataSources.map((d) => d.structure.id)

  const batchSize = 100
  let skip = 0
  let hasMoreResults = true

  while (hasMoreResults) {
    const tables = await prisma().dataSourceSchemaTable.findMany({
      where: { dataSourceSchemaId: { in: schemaIds } },
      skip,
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    })

    skip += batchSize
    hasMoreResults = tables.length === batchSize // If fewer than 100 results are returned, we're done

    for (const table of tables) {
      const dataSourceId = schemaToDataSourceId.get(table.dataSourceSchemaId)
      if (!dataSourceId) {
        continue
      }

      const columns = z.array(DataSourceColumn).safeParse(table.columns)
      if (!columns.success) {
        logger().error(
          {
            tableId: table.id,
            dataSourceSchemaId: table.dataSourceSchemaId,
            dataSourceId,
          },
          'Error parsing columns for table'
        )
        continue
      }

      yield {
        schemaName: table.schema,
        tableName: table.name,
        dataSourceId,
        table: { columns: columns.data },
      }
    }
  }
}
