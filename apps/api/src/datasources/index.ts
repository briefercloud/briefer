import { DataSource } from '@briefer/database'
import * as bq from './bigquery.js'
import * as redshift from './redshift.js'
import * as psql from './psql.js'
import * as athena from './athena.js'
import * as oracle from './oracle.js'
import * as mysql from './mysql.js'
import * as trino from './trino.js'
import * as sqlserver from './sqlserver.js'
import * as snowflake from './snowflake.js'
import { DataSourceConnectionError } from '@briefer/types'

export async function ping(ds: DataSource): Promise<DataSource> {
  let result: DataSource
  switch (ds.type) {
    case 'bigquery':
      result = await bq.ping(ds.data)
      break
    case 'redshift':
      result = await redshift.ping(ds.data)
      break
    case 'psql':
      result = await psql.ping(ds.data)
      break
    case 'athena':
      result = await athena.ping(ds.data)
      break
    case 'oracle':
      result = await oracle.ping(ds.data)
      break
    case 'mysql':
      result = await mysql.ping(ds.data)
      break
    case 'sqlserver':
      result = await sqlserver.ping(ds.data)
      break
    case 'trino':
      result = await trino.ping(ds.data)
      break
    case 'snowflake':
      result = await snowflake.ping(ds.data)
      break
  }

  return result
}

export type DataSourceStatus =
  | {
      connStatus: 'online'
      lastConnection: Date
    }
  | {
      connStatus: 'offline'
      connError: DataSourceConnectionError
    }

export async function updateConnStatus(
  ds: DataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  switch (ds.type) {
    case 'bigquery':
      return bq.updateConnStatus(ds.data, status)
    case 'redshift':
      return redshift.updateConnStatus(ds.data, status)
    case 'psql':
      return psql.updateConnStatus(ds.data, status)
    case 'athena':
      return athena.updateConnStatus(ds.data, status)
    case 'oracle':
      return oracle.updateConnStatus(ds.data, status)
    case 'mysql':
      return mysql.updateConnStatus(ds.data, status)
    case 'sqlserver':
      return sqlserver.updateConnStatus(ds.data, status)
    case 'trino':
      return trino.updateConnStatus(ds.data, status)
    case 'snowflake':
      return snowflake.updateConnStatus(ds.data, status)
  }
}
