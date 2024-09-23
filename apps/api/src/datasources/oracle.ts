import { config } from '../config/index.js'
import prisma, { DataSource, OracleDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { getOracleSchema, pingOracle } from '../python/query/oracle.js'
import { logger } from '../logger.js'
import { DataSourceStructure } from '@briefer/types'

export async function ping(ds: OracleDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingOracle(ds, config().DATASOURCES_ENCRYPTION_KEY)

  logger().error({ err }, 'ping error')

  if (!err) {
    return updateConnStatus(ds, {
      connStatus: 'online',
      lastConnection,
    })
  }

  return updateConnStatus(ds, { connStatus: 'offline', connError: err })
}

export async function getSchema(
  ds: OracleDataSource
): Promise<DataSourceStructure> {
  return getOracleSchema(ds, config().DATASOURCES_ENCRYPTION_KEY)
}

export async function updateConnStatus(
  ds: OracleDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().oracleDataSource.update({
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
    type: 'oracle',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
