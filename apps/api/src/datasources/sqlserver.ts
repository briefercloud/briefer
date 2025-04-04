import { config } from '../config/index.js'
import prisma, { SQLServerDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingSQLServer } from '../python/query/sqlserver.js'

export async function ping(
  ds: SQLServerDataSource
): Promise<SQLServerDataSource> {
  const lastConnection = new Date()

  const err = await pingSQLServer(ds, config().DATASOURCES_ENCRYPTION_KEY)
  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function updateConnStatus(
  ds: SQLServerDataSource,
  status: DataSourceStatus
): Promise<SQLServerDataSource> {
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
    ...ds,
    connStatus: newDs.connStatus,
    lastConnection: newDs.lastConnection?.toISOString() ?? null,
    connError: newDs.connError,
  }
}
