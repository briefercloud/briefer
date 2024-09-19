import { config } from '../config/index.js'
import prisma, {
  DataSource,
  MySQLDataSource,
  getMySQLCert,
  getMySQLPassword,
} from '@briefer/database'
import mysql, { RowDataPacket } from 'mysql2/promise'
import { logger } from '../logger.js'
import { DataSourceConnectionError, DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'

async function getMySQLConfig(
  datasource: MySQLDataSource
): Promise<mysql.ConnectionOptions> {
  const password = encodeURIComponent(
    await getMySQLPassword(datasource, config().DATASOURCES_ENCRYPTION_KEY)
  )

  const cert = await getMySQLCert(
    datasource,
    config().DATASOURCES_ENCRYPTION_KEY
  )

  const connectionString = `mysql://${datasource.username}:${password}@${datasource.host}:${datasource.port}/${datasource.database}`

  return {
    uri: connectionString,
    ssl: cert ? { ca: cert } : undefined,
  }
}

export async function ping(datasource: MySQLDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const mySQLConfig = await getMySQLConfig(datasource)

  const err = await pingMySQLFromConfig(mySQLConfig)

  if (!err) {
    return updateConnStatus(datasource, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(datasource, { connStatus: 'offline', connError: err })
}

async function pingMySQLFromConfig(
  config: mysql.ConnectionOptions
): Promise<DataSourceConnectionError | null> {
  try {
    const connection = await mysql.createConnection(config)

    return await Promise.race([
      new Promise<DataSourceConnectionError>((resolve) =>
        setTimeout(
          () =>
            resolve({
              name: 'TimeoutError',
              message: 'Did not receive response from MySQL within 10s',
            }),
          10000 // 10s timeout
        )
      ),
      new Promise<DataSourceConnectionError | null>(async (resolve) => {
        try {
          await connection.query('SELECT 1')
          resolve(null)
        } catch (err) {
          logger().info({ err }, 'Error pinging MySQL')
          const parsedError = DataSourceConnectionError.safeParse(err)
          if (!parsedError.success) {
            logger().error(
              {
                error: err,
              },
              'Failed to parse error from MySQL ping'
            )
            resolve({ name: 'UnknownError', message: 'Unknown error' })
            return
          }

          resolve(parsedError.data)
        } finally {
          connection.end()
        }
      }),
    ])
  } catch (err) {
    logger().info({ err }, 'Error pinging MySQL')
    const parsedError = DataSourceConnectionError.safeParse(err)
    if (!parsedError.success) {
      logger().error(
        {
          error: err,
        },
        'Failed to parse error from MySQL ping'
      )
      return { name: 'UnknownError', message: 'Unknown error' }
    }

    return parsedError.data
  }
}

interface InformationSchemaColumn extends RowDataPacket {
  TABLE_SCHEMA: string
  TABLE_NAME: string
  COLUMN_NAME: string
  DATA_TYPE: string
}

export async function getMySQLSchemaFromConfig(
  datasourceId: string,
  mySQLConfig: mysql.ConnectionOptions
): Promise<DataSourceStructure> {
  const connection = await mysql.createConnection(mySQLConfig)

  // select all tables with their column names and types from all schemas
  const [rows]: [InformationSchemaColumn[], unknown] = await connection.query(`
    SELECT table_schema, table_name, column_name, data_type
    FROM information_schema.columns
    WHERE table_schema NOT IN ('information_schema', 'performance_schema', 'mysql', 'sys')
  `)

  const info: DataSourceStructure = {
    dataSourceId: datasourceId,
    schemas: {},
    defaultSchema: 'public',
  }

  for (const row of rows) {
    const schemaName = row.TABLE_SCHEMA
    const tableName = row.TABLE_NAME
    const columnName = row.COLUMN_NAME
    const dataType = row.DATA_TYPE

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

  await connection.end()

  return info
}

export async function getSchema(
  datasource: MySQLDataSource
): Promise<DataSourceStructure> {
  const mySQLConfig = await getMySQLConfig(datasource)

  return getMySQLSchemaFromConfig(datasource.id, mySQLConfig)
}

export async function updateConnStatus(
  ds: MySQLDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().mySQLDataSource.update({
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
    type: 'mysql',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
