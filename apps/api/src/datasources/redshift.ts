import pg from 'pg'
import config from '../config/index.js'
import prisma, {
  DataSource,
  RedshiftDataSource,
  getRedshiftPassword,
} from '@briefer/database'
import { getPSQLSchemaFromConfig, pingPSQLFromConfig } from './psql.js'
import { DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'

async function getPGConfig(
  datasource: RedshiftDataSource
): Promise<pg.ClientConfig> {
  const password = await getRedshiftPassword(
    datasource,
    config().DATASOURCES_ENCRYPTION_KEY
  )

  return {
    host: datasource.host,
    database: datasource.database,
    user: datasource.username,
    password,
    port: parseInt(datasource.port),
  }
}

export async function ping(
  datasource: RedshiftDataSource
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

export async function getSchema(
  datasource: RedshiftDataSource
): Promise<DataSourceStructure> {
  const pgConfig = await getPGConfig(datasource)

  try {
    return await getPSQLSchemaFromConfig(datasource.id, pgConfig)
  } catch {}

  const client = new pg.Client(pgConfig)
  await client.connect()

  // select all tables with their column names and types from all schemas
  const res = await client.query(`
SELECT
    t.schemaname AS table_schema,
    t.tablename AS table_name,
    c.column AS column_name,
    c.type AS data_type
FROM
    pg_catalog.pg_table_def c
JOIN
    pg_catalog.pg_tables t
    ON c.tablename = t.tablename
    AND c.schemaname = t.schemaname
WHERE
    t.tableowner != 'rdsdb'
ORDER BY
    t.schemaname,
    t.tablename,
    c.column`)

  const info: DataSourceStructure = {
    dataSourceId: datasource.id,
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

export async function updateConnStatus(
  ds: RedshiftDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().redshiftDataSource.update({
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
    type: 'redshift',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
