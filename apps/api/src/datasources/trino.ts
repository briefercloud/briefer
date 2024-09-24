import prisma, { DataSource, TrinoDataSource } from '@briefer/database'
import { DataSourceStructure } from '@briefer/types'
import { DataSourceStatus } from './index.js'
import { pingTrino, getTrinoSchema } from '../python/query/trino.js'
import { config } from '../config/index.js'
import { OnTable } from './structure.js'

export async function ping(ds: TrinoDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingTrino(ds, config().DATASOURCES_ENCRYPTION_KEY)

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function getSchema(
  ds: TrinoDataSource,
  onTable: OnTable
): Promise<DataSourceStructure> {
  return getTrinoSchema(ds, config().DATASOURCES_ENCRYPTION_KEY, onTable)
}

export async function updateConnStatus(
  ds: TrinoDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().trinoDataSource.update({
    where: { id: ds.id },
    data: {
      connStatus: status.connStatus,
      lastConnection:
        status.connStatus === 'online' ? status.lastConnection : undefined,
      connError:
        status.connStatus === 'offline'
          ? JSON.stringify({
              name: status.connError.name,
              message: status.connError.message,
            })
          : undefined,
    },
  })

  return {
    type: 'trino',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
