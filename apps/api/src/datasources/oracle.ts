import { config } from '../config/index.js'
import prisma, { OracleDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingOracle } from '../python/query/oracle.js'
import { logger } from '../logger.js'

export async function ping(ds: OracleDataSource): Promise<OracleDataSource> {
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

export async function updateConnStatus(
  ds: OracleDataSource,
  status: DataSourceStatus
): Promise<OracleDataSource> {
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
    ...ds,
    connStatus: newDs.connStatus,
    lastConnection: newDs.lastConnection?.toISOString() ?? null,
    connError: newDs.connError,
  }
}
