import { config } from '../config/index.js'
import prisma, { PostgreSQLDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingPSQL } from '../python/query/psql.js'

export async function ping(
  ds: PostgreSQLDataSource
): Promise<PostgreSQLDataSource> {
  const lastConnection = new Date()
  const err = await pingPSQL(ds, 'psql', config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function updateConnStatus(
  ds: PostgreSQLDataSource,
  status: DataSourceStatus
): Promise<PostgreSQLDataSource> {
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
    ...ds,
    connStatus: newDs.connStatus,
    lastConnection: newDs.lastConnection?.toISOString() ?? null,
    connError: newDs.connError,
  }
}
