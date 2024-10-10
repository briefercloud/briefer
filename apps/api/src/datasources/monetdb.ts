import { config } from '../config/index.js'
import prisma, { DataSource, MonetDBDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingMonetDb } from '../python/query/monetdb.js'

export async function ping(ds: MonetDBDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingMonetDb(ds, config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function updateConnStatus(
  ds: MonetDBDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().monetDBDataSource.update({
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
    type: "monetdb",
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
