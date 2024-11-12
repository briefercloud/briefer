import { config } from '../config/index.js'
import prisma, { MySQLDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { OnTable } from './structure.js'
import { pingMySQL } from '../python/query/mysql.js'
import { getSQLAlchemySchema } from '../python/query/sqlalchemy.js'

export async function ping(
  datasource: MySQLDataSource
): Promise<MySQLDataSource> {
  const lastConnection = new Date()
  const err = await pingMySQL(datasource, config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(datasource, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(datasource, { connStatus: 'offline', connError: err })
}

export async function getMySQLSchema(
  datasource: MySQLDataSource,
  onTable: OnTable
): Promise<void> {
  return getSQLAlchemySchema(
    { type: 'mysql', data: datasource },
    config().DATASOURCES_ENCRYPTION_KEY,
    null,
    onTable
  )
}

export async function updateConnStatus(
  ds: MySQLDataSource,
  status: DataSourceStatus
): Promise<MySQLDataSource> {
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
    ...ds,
    connStatus: newDs.connStatus,
    lastConnection: newDs.lastConnection?.toISOString() ?? null,
    connError: newDs.connError,
  }
}
