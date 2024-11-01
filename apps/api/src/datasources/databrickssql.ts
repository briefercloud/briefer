import { config } from '../config/index.js'
import prisma, { DatabricksSQLDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingDatabricksSQL } from '../python/query/databrickssql.js'

export async function ping(ds: DatabricksSQLDataSource): Promise<DatabricksSQLDataSource> {
  const lastConnection = new Date()
  const err = await pingDatabricksSQL(ds, config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function updateConnStatus(
  ds: DatabricksSQLDataSource,
  status: DataSourceStatus
): Promise<DatabricksSQLDataSource> {
  const newDs = await prisma().databricksSQLDataSource.update({
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
