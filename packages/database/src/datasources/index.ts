import qs from 'querystring'
import prisma from '../index.js'
import * as bq from './bigquery.js'
import { decrypt } from './crypto.js'
import * as psql from './psql.js'
import * as redshift from './redshift.js'
import * as athena from './athena.js'
import * as oracle from './oracle.js'
import * as mysql from './mysql.js'
import * as trino from './trino.js'
import * as snowflake from './snowflake.js'
import { DataSourceStructureStateV2 } from '@briefer/types'
import { z } from 'zod'

export * from './bigquery.js'
export * from './psql.js'
export * from './oracle.js'
export * from './redshift.js'
export * from './athena.js'
export * from './mysql.js'
export * from './crypto.js'
export * from './trino.js'
export * from './snowflake.js'

export type BigQueryDataSource = bq.BigQueryDataSource
export type PostgreSQLDataSource = psql.PostgreSQLDataSource
export type RedshiftDataSource = redshift.RedshiftDataSource
export type AthenaDataSource = athena.AthenaDataSource
export type OracleDataSource = oracle.OracleDataSource
export type MySQLDataSource = mysql.MySQLDataSource
export type TrinoDataSource = trino.TrinoDataSource
export type SnowflakeDataSource = snowflake.SnowflakeDataSource

export type DataSource =
  | { type: 'psql'; data: PostgreSQLDataSource }
  | { type: 'bigquery'; data: BigQueryDataSource }
  | { type: 'redshift'; data: RedshiftDataSource }
  | { type: 'athena'; data: AthenaDataSource }
  | { type: 'oracle'; data: OracleDataSource }
  | { type: 'mysql'; data: MySQLDataSource }
  | { type: 'trino'; data: TrinoDataSource }
  | { type: 'snowflake'; data: SnowflakeDataSource }

export type DataSourceType = DataSource['type']

export const DataSourceType = z.enum([
  'psql',
  'bigquery',
  'redshift',
  'athena',
  'oracle',
  'mysql',
  'trino',
  'snowflake'
] as const)

// Ensure Zod enum stays in sync with `DataSourceType`
// A type-level validation to ensure the Zod enum matches the `DataSourceType`
// If `ValidateDataSourceTypes` is `never`, TypeScript will error, forcing you to update one of the definitions.
type ValidateDataSourceTypes =
  z.infer<typeof DataSourceType> extends DataSourceType
    ? DataSourceType extends z.infer<typeof DataSourceType>
      ? true
      : never
    : never
const checkDataSourceTypes: ValidateDataSourceTypes = true
// void to stop no unused variable error
void checkDataSourceTypes

export async function listDataSources(
  workspaceId: string
): Promise<DataSource[]> {
  const dbs = await Promise.all([
    psql.listPSQLDataSources(workspaceId),
    bq.listBigQueryDataSources(workspaceId),
    redshift.listRedshiftDataSources(workspaceId),
    athena.listAthenaDataSources(workspaceId),
    oracle.listOracleDataSources(workspaceId),
    mysql.listMySQLDataSources(workspaceId),
    trino.listTrinoDataSources(workspaceId),
    snowflake.listSnowflakeDataSources(workspaceId),
  ])

  return dbs.reduce((acc, cur) => acc.concat(cur), [])
}

export async function getDatasource(
  workspaceId: string,
  id: string,
  type: DataSource['type']
): Promise<DataSource | null> {
  switch (type) {
    case 'bigquery':
      return bq
        .getBigQueryDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'bigquery', data } : null
        )
    case 'psql':
      return psql
        .getPSQLDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'psql', data } : null
        )
    case 'redshift':
      return redshift
        .getRedshiftDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'redshift', data } : null
        )
    case 'athena':
      return athena
        .getAthenaDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'athena', data } : null
        )
    case 'oracle':
      return oracle
        .getOracleDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'oracle', data } : null
        )
    case 'mysql':
      return mysql
        .getMySQLDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'mysql', data } : null
        )
    case 'trino':
      return trino
        .getTrinoDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'trino', data } : null
        )
    case 'snowflake':
      return snowflake
        .getSnowflakeDataSource(workspaceId, id)
        .then((data): DataSource | null =>
          data ? { type: 'snowflake', data } : null
        )
  }
}

export async function getDatasourcePassword(
  datasource: DataSource,
  encryptionKey: string
): Promise<string> {
  switch (datasource.type) {
    case 'psql':
      return prisma()
        .postgreSQLDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) => decrypt(row.password, encryptionKey))
    case 'redshift':
      return prisma()
        .redshiftDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) => decrypt(row.password, encryptionKey))
    case 'oracle':
      return prisma()
        .oracleDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) => decrypt(row.password, encryptionKey))
    case 'mysql':
      return prisma()
        .mySQLDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) => decrypt(row.password, encryptionKey))
    case 'trino':
      return prisma()
        .trinoDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) =>
          row.password !== null ? decrypt(row.password, encryptionKey) : ''
        )
    case 'bigquery':
    case 'athena':
      return ''
    case 'snowflake':
      return prisma()
        .snowflakeDataSource.findFirstOrThrow({
          where: { id: datasource.data.id },
          select: { password: true },
        })
        .then((row) => decrypt(row.password, encryptionKey))
  }
}

export async function getDatabaseURL(
  ds: DataSource,
  encryptionKey: string
): Promise<string> {
  switch (ds.type) {
    case 'psql': {
      // TODO: differenciate DataSource and APIDataSource
      const dbDs = await prisma().postgreSQLDataSource.findFirstOrThrow({
        where: { id: ds.data.id },
      })
      const password = encodeURIComponent(
        await getDatasourcePassword(ds, encryptionKey)
      )
      return `postgresql://${dbDs.username}:${password}@${dbDs.host}:${dbDs.port}/${dbDs.database}`
    }
    case 'redshift': {
      const password = encodeURIComponent(
        await getDatasourcePassword(ds, encryptionKey)
      )
      return `redshift+redshift_connector://${ds.data.username}:${password}@${ds.data.host}:${ds.data.port}/${ds.data.database}`
    }
    case 'trino': {
      const password = encodeURIComponent(
        await getDatasourcePassword(ds, encryptionKey)
      )
      let userPass = `${ds.data.username}`
      if (password !== '') {
        userPass += `:${password}`
      }

      let url = `trino://${userPass}@${ds.data.host}:${ds.data.port}`
      if (ds.data.catalog !== null) {
        url += `/${ds.data.catalog}`
      }
      return url
    }
    case 'bigquery':
      return `bigquery://${ds.data.projectId}`
    case 'athena': {
      const { accessKeyId, secretAccessKeyId } =
        await prisma().athenaDataSource.findFirstOrThrow({
          where: { id: ds.data.id },
          select: { accessKeyId: true, secretAccessKeyId: true },
        })

      const params = qs.stringify({
        s3_staging_dir: ds.data.s3OutputPath,
        aws_access_key_id: decrypt(accessKeyId, encryptionKey),
        aws_secret_access_key: decrypt(secretAccessKeyId, encryptionKey),
      })

      return `awsathena+rest://@athena.${ds.data.region}.amazonaws.com:443?${params}`
    }
    case 'oracle': {
      const password = await getDatasourcePassword(ds, encryptionKey)

      let connectData = ''
      if (ds.data.serviceName) {
        connectData += `(service_name=${ds.data.serviceName})`
      }
      if (ds.data.sid) {
        connectData += `(sid=${ds.data.sid})`
      }

      if (connectData === '' && ds.data.database) {
        return `oracle+oracledb://${ds.data.username}:${password}@${ds.data.host}:${ds.data.port}/${ds.data.database}`
      }

      if (connectData !== '') {
        connectData = `(connect_data=${connectData})`
      }

      return `oracle+oracledb://${ds.data.username}:${password}@(description=(retry_count=20)(retry_delay=3)(address=(protocol=tcps)(port=${ds.data.port})(host=${ds.data.host}))${connectData}(security=(ssl_server_dn_match=yes)))`
    }
    case 'mysql': {
      const password = encodeURIComponent(
        await getDatasourcePassword(ds, encryptionKey)
      )
      return `mysql+mysqldb://${ds.data.username}:${password}@${ds.data.host}:${ds.data.port}/${ds.data.database}?ssl_mode=REQUIRED`
    }
    case 'snowflake': {
      // TODO-SNOWFLAKE: ADD THE DATABASE URL FOR THE SNOWFLAKE CONNECTION
    }
  }
}

export async function getCredentialsInfo(
  ds: DataSource,
  encryptionKey: string
): Promise<object | null> {
  switch (ds.type) {
    case 'psql': {
      const psql = await prisma().postgreSQLDataSource.findFirstOrThrow({
        where: { id: ds.data.id },
      })
      if (!psql.cert) {
        return null
      }

      return {
        sslrootcert: decrypt(psql.cert, encryptionKey),
      }
    }
    case 'redshift':
      const rsft = await prisma().redshiftDataSource.findFirstOrThrow({
        where: { id: ds.data.id },
      })
      if (!rsft.cert) {
        return null
      }

      return {
        sslrootcert: decrypt(rsft.cert, encryptionKey),
      }
    case 'bigquery': {
      const bq = await prisma().bigQueryDataSource.findFirstOrThrow({
        where: { id: ds.data.id },
      })
      return JSON.parse(decrypt(bq.serviceAccountKey, encryptionKey))
    }
    case 'athena':
    case 'oracle':
    case 'trino':
      return null
    case 'mysql': {
      const mysql = await prisma().mySQLDataSource.findFirstOrThrow({
        where: { id: ds.data.id },
      })
      if (!mysql.cert) {
        return null
      }

      return {
        sslrootcert: decrypt(mysql.cert, encryptionKey),
      }
    }
    case 'snowflake':
      return null
  }
}

export type APIDataSource = {
  config: DataSource
  structure: DataSourceStructureStateV2
}
