import prisma, { BigQueryDataSource, DataSource } from '@briefer/database'
import { config } from '../config/index.js'
import { DataSourceStatus } from './index.js'
import { pingBigQuery } from '../python/query/bigquery.js'

export async function ping(ds: BigQueryDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingBigQuery(ds, config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function updateConnStatus(
  ds: BigQueryDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().bigQueryDataSource.update({
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
    type: 'bigquery',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
