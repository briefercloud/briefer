import { APIDataSource, ApiUser } from '@briefer/database'
import * as bq from './bigquery.js'
import * as redshift from './redshift.js'
import * as psql from './psql.js'
import * as athena from './athena.js'
import * as oracle from './oracle.js'
import * as mysql from './mysql.js'
import * as trino from './trino.js'
import * as sqlserver from './sqlserver.js'
import * as snowflake from './snowflake.js'
import * as databrickssql from './databrickssql.js'
import { DataSourceConnectionError } from '@briefer/types'
import { IOServer } from '../websocket/index.js'
import { broadcastDataSource } from '../websocket/workspace/data-sources.js'
import * as posthog from '../events/posthog.js'

export async function ping(
  user: ApiUser,
  socket: IOServer,
  ds: APIDataSource
): Promise<APIDataSource> {
  await updateConnStatus(ds, { connStatus: 'checking' })
  broadcastDataSource(socket, ds)

  ds.config.data = await (() => {
    switch (ds.config.type) {
      case 'bigquery':
        return bq.ping(ds.config.data)
      case 'redshift':
        return redshift.ping(ds.config.data)
      case 'psql':
        return psql.ping(ds.config.data)
      case 'athena':
        return athena.ping(ds.config.data)
      case 'oracle':
        return oracle.ping(ds.config.data)
      case 'mysql':
        return mysql.ping(ds.config.data)
      case 'sqlserver':
        return sqlserver.ping(ds.config.data)
      case 'trino':
        return trino.ping(ds.config.data)
      case 'snowflake':
        return snowflake.ping(ds.config.data)
      case 'databrickssql':
        return databrickssql.ping(ds.config.data)
    }
  })()
  broadcastDataSource(socket, ds)

  posthog.captureDatasourceStatusUpdate(
    user,
    ds.config.data.workspaceId,
    ds.config.data.id,
    ds.config.type,
    ds.config.data.connStatus === 'online'
  )

  return ds
}

export type DataSourceStatus =
  | {
      connStatus: 'online'
      lastConnection: Date
    }
  | { connStatus: 'checking' }
  | {
      connStatus: 'offline'
      connError: DataSourceConnectionError
    }

export async function updateConnStatus<T extends Pick<APIDataSource, 'config'>>(
  ds: T,
  status: DataSourceStatus
): Promise<T> {
  switch (ds.config.type) {
    case 'bigquery':
      ds.config.data = await bq.updateConnStatus(ds.config.data, status)
      return ds
    case 'redshift':
      ds.config.data = await redshift.updateConnStatus(ds.config.data, status)
      return ds
    case 'psql':
      ds.config.data = await psql.updateConnStatus(ds.config.data, status)
      return ds
    case 'athena':
      ds.config.data = await athena.updateConnStatus(ds.config.data, status)
      return ds
    case 'oracle':
      ds.config.data = await oracle.updateConnStatus(ds.config.data, status)
      return ds
    case 'mysql':
      ds.config.data = await mysql.updateConnStatus(ds.config.data, status)
      return ds
    case 'sqlserver':
      ds.config.data = await sqlserver.updateConnStatus(ds.config.data, status)
      return ds
    case 'trino':
      ds.config.data = await trino.updateConnStatus(ds.config.data, status)
      return ds
    case 'snowflake':
      ds.config.data = await snowflake.updateConnStatus(ds.config.data, status)
      return ds
    case 'databrickssql':
      ds.config.data = await databrickssql.updateConnStatus(
        ds.config.data,
        status
      )
      return ds
  }
}
