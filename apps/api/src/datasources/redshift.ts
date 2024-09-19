import { config } from '../config/index.js'
import prisma, { DataSource, RedshiftDataSource } from '@briefer/database'
import { DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'
import { getPSQLSchema, pingPSQL } from '../python/query/psql.js'

export async function ping(ds: RedshiftDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingPSQL(
    ds,
    'redshift',
    config().DATASOURCES_ENCRYPTION_KEY
  )

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function getSchema(
  ds: RedshiftDataSource
): Promise<DataSourceStructure> {
  return getPSQLSchema(ds, 'redshift', config().DATASOURCES_ENCRYPTION_KEY)
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
