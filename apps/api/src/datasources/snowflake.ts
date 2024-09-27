import { config } from '../config/index.js'
import prisma, { DataSource, SnowflakeDataSource } from '@briefer/database'
import { DataSourceStatus } from './index.js'
import { pingSnowflake } from '../python/query/snowflake.js'
import { logger } from '../logger.js'

export async function ping(ds: SnowflakeDataSource): Promise<DataSource> {
  const lastConnection = new Date()
  const err = await pingSnowflake(ds, config().DATASOURCES_ENCRYPTION_KEY)

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
  ds: SnowflakeDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().snowflakeDataSource.update({
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
    type: 'snowflake',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
