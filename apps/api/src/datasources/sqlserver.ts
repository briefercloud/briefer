import { config } from '../config/index.js'
import prisma, {
  DataSource,
  SQLServerDataSource,
  getSQLServerCert,
  getSQLServerPassword,
} from '@briefer/database'
import sql from 'mssql'
import { logger } from '../logger.js'
import { DataSourceConnectionError, DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'

type ConnectionConfig = {
  user: string;
  password: string;
  server: string;
  database: string;
  ssl?: { ca: Buffer }
}

async function getSQLServerConfig(
  datasource: SQLServerDataSource
): Promise<ConnectionConfig> {
  const password = await getSQLServerPassword(datasource, config().DATASOURCES_ENCRYPTION_KEY)

  const cert = await getSQLServerCert(
    datasource,
    config().DATASOURCES_ENCRYPTION_KEY
  )
  
  return {
    user: datasource.username,
    password,
    database: datasource.database,
    server: datasource.host,
    ssl: cert ? { ca: cert } : undefined
  }
}

export async function ping(datasource: SQLServerDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const SQLServerConfig = await getSQLServerConfig(datasource)

  const err = await pingSQLServerFromConfig(SQLServerConfig)

  if (!err) {
    return updateConnStatus(datasource, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(datasource, { connStatus: 'offline', connError: err })
}

async function createConnection(config: ConnectionConfig): Promise<sql.ConnectionPool> {
  const mustEncrypt = config.ssl ? true : false;
  return sql.connect({
    user: config.user,
    password: config.password,
    server: config.server,
    database: config.database,
    options: {
      trustServerCertificate: mustEncrypt ? false : true,
      encrypt: mustEncrypt,
      cryptoCredentialsDetails: {
        ca: config.ssl?.ca
      }
    }
  })
}

async function pingSQLServerFromConfig(
  config: ConnectionConfig
): Promise<DataSourceConnectionError | null> {
  try {
    const connection = await createConnection(config);

    return await Promise.race([
      new Promise<DataSourceConnectionError>((resolve) =>
        setTimeout(
          () =>
            resolve({
              name: 'TimeoutError',
              message: 'Did not receive response from SQLServer within 10s',
            }),
          10000 // 10s timeout
        )
      ),
      new Promise<DataSourceConnectionError | null>(async (resolve) => {
        try {
          await connection.query('SELECT 1')
          resolve(null)
        } catch (err) {
          logger().info({ err }, 'Error pinging SQLServer')
          const parsedError = DataSourceConnectionError.safeParse(err)
          if (!parsedError.success) {
            logger().error(
              {
                error: err,
              },
              'Failed to parse error from SQLServer ping'
            )
            resolve({ name: 'UnknownError', message: 'Unknown error' })
            return
          }

          resolve(parsedError.data)
        } finally {
          connection.close()
        }
      }),
    ])
  } catch (err) {
    logger().info({ err }, 'Error pinging SQLServer')
    const parsedError = DataSourceConnectionError.safeParse(err)
    if (!parsedError.success) {
      logger().error(
        {
          error: err,
        },
        'Failed to parse error from SQLServer ping'
      )
      return { name: 'UnknownError', message: 'Unknown error' }
    }

    return parsedError.data
  }
}

export async function getSQLServerSchemaFromConfig(
  datasourceId: string,
  sqlServerConfig: ConnectionConfig
): Promise<DataSourceStructure> {
  const connection = await createConnection(sqlServerConfig);

  // select all tables with their column names and types from all schemas
  const result = await connection.query(`
    SELECT TABLE_SCHEMA, TABLE_NAME, COLUMN_NAME, DATA_TYPE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA NOT IN ('information_schema', 'sys', 'master', 'tempdb', 'model', 'msdb');
  `)

  const info: DataSourceStructure = {
    dataSourceId: datasourceId,
    schemas: {},
    defaultSchema: 'public',
  }

  for (const row of result.recordset) {
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

  await connection.close()

  return info
}

export async function getSchema(
  datasource: SQLServerDataSource
): Promise<DataSourceStructure> {
  const SQLServerConfig = await getSQLServerConfig(datasource)

  return getSQLServerSchemaFromConfig(datasource.id, SQLServerConfig)
}

export async function updateConnStatus(
  ds: SQLServerDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().sQLServerDataSource.update({
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
    type: 'sqlserver',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
