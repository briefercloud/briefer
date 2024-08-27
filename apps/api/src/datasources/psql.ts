import config from '../config/index.js'
import prisma, {
  DataSource,
  PostgreSQLDataSource,
  getPSQLCert,
  getPSQLPassword,
} from '@briefer/database'
import pg from 'pg'
import { logger } from '../logger.js'
import { DataSourceConnectionError, DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'

async function getPGConfig(
  datasource: PostgreSQLDataSource
): Promise<pg.ClientConfig> {
  let ds = {
    username: datasource.username,
    host: datasource.host,
    port: datasource.port,
    database: datasource.database,
  }

  if (datasource.isDemo) {
    const db = await prisma().postgreSQLDataSource.findFirstOrThrow({
      where: { id: datasource.id },
    })
    ds = {
      username: db.username,
      host: db.host,
      port: db.port,
      database: db.database,
    }
  }

  const password = encodeURIComponent(
    await getPSQLPassword(datasource, config().DATASOURCES_ENCRYPTION_KEY)
  )
  const cert = await getPSQLCert(
    datasource,
    config().DATASOURCES_ENCRYPTION_KEY
  )

  const connectionString = `postgresql://${ds.username}:${password}@${ds.host}:${ds.port}/${ds.database}`

  return {
    connectionString,
    ssl: cert
      ? { ca: cert }
      : // allow self-signed certificates
        { rejectUnauthorized: false },
  }
}

export async function ping(
  datasource: PostgreSQLDataSource
): Promise<DataSource> {
  const lastConnection = new Date()
  const pgConfig = await getPGConfig(datasource)

  const err = await pingPSQLFromConfig(
    pgConfig,
    datasource.workspaceId,
    datasource.id
  )

  if (!err) {
    return updateConnStatus(datasource, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(datasource, { connStatus: 'offline', connError: err })
}

export async function pingPSQLFromConfig(
  config: pg.ClientConfig,
  workspaceId: string,
  dataSourceId: string
): Promise<DataSourceConnectionError | null> {
  try {
    const client = new pg.Client(config)

    return await Promise.race([
      new Promise<DataSourceConnectionError>((resolve) =>
        setTimeout(
          () =>
            resolve({
              name: 'TimeoutError',
              message: 'Did not receive a response from PostgreSQL within 10s',
            }),
          10000 // 10s timeout
        )
      ),
      new Promise<DataSourceConnectionError | null>(async (resolve) => {
        try {
          await client.connect()
          await client.query('SELECT 1')
          resolve(null)
        } catch (err) {
          logger.info({ err }, 'Error pinging PostgreSQL')
          const parsedErr = DataSourceConnectionError.safeParse(err)
          if (!parsedErr.success) {
            logger.error(
              {
                error: err,
                workspaceId,
                dataSourceId,
              },
              'Failed to parse error from PostgreSQL ping'
            )

            resolve({ name: 'UnknownError', message: 'Unknown error' })
            return
          }

          resolve(parsedErr.data)
        } finally {
          client.end()
        }
      }),
    ])
  } catch (err) {
    logger.info({ err }, 'Error pinging PostgreSQL')
    const parsedErr = DataSourceConnectionError.safeParse(err)
    if (!parsedErr.success) {
      logger.error(
        {
          error: err,
          workspaceId,
          dataSourceId,
        },
        'Failed to parse error from PostgreSQL ping'
      )

      return { name: 'UnknownError', message: 'Unknown error' }
    }

    return parsedErr.data
  }
}

export async function getPSQLSchemaFromConfig(
  datasourceId: string,
  pgConfig: pg.ClientConfig
): Promise<DataSourceStructure> {
  const client = new pg.Client(pgConfig)
  await client.connect()

  // select all tables with their column names and types from all schemas
  const res = await client.query(`
    SELECT
      table_schema,
      table_name,
      column_name,
      data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
    ORDER BY table_schema, table_name, ordinal_position
  `)

  const info: DataSourceStructure = {
    dataSourceId: datasourceId,
    schemas: {},
    defaultSchema: 'public',
  }
  for (const row of res.rows) {
    const schemaName = row.table_schema
    const tableName = row.table_name
    const columnName = row.column_name
    const dataType = row.data_type

    const schema = info.schemas[schemaName] ?? {
      tables: {},
    }

    const table = schema.tables[tableName] ?? {
      columns: [],
    }

    table.columns.push({ name: columnName, type: dataType })

    schema.tables[tableName] = table
    info.schemas[schemaName] = schema
  }

  await client.end()

  return info
}

export async function getSchema(
  datasource: PostgreSQLDataSource
): Promise<DataSourceStructure> {
  const pgConfig = await getPGConfig(datasource)

  return getPSQLSchemaFromConfig(datasource.id, pgConfig)
}

export async function updateConnStatus(
  ds: PostgreSQLDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().postgreSQLDataSource.update({
    where: { id: ds.id },
    data: {
      connStatus: status.connStatus,
      lastConnection:
        status.connStatus === 'online' ? status.lastConnection : undefined,
      connError:
        status.connStatus === 'offline'
          ? JSON.stringify(status.connError)
          : undefined,
    },
  })

  return {
    type: 'psql',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
