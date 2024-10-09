import { DataSource } from '@briefer/database'
import { WriteBackResult } from '@briefer/types'
import { writebackPSQL } from './psql.js'
import { writebackBigQuery } from './bigquery.js'

export const WRITEBACK_ENABLED_DATASOURCE_TYPES = new Set<DataSource['type']>([
  'psql',
  'bigquery',
])

export type Writeback = {
  promise: Promise<WriteBackResult>
  abort: () => Promise<void>
}

export async function writeback(
  workspaceId: string,
  sessionId: string,
  dataframeName: string,
  datasource: DataSource,
  tableName: string,
  overwriteTable: boolean,
  onConflict: 'update' | 'ignore',
  onConflictColumns: string[],
  encryptionKey: string
): Promise<Writeback> {
  switch (datasource.type) {
    case 'psql':
    case 'redshift':
      return writebackPSQL(
        workspaceId,
        sessionId,
        dataframeName,
        datasource,
        tableName,
        overwriteTable,
        onConflict,
        encryptionKey
      )
    case 'bigquery':
      return writebackBigQuery(
        workspaceId,
        sessionId,
        dataframeName,
        datasource.data,
        tableName,
        overwriteTable,
        onConflict,
        onConflictColumns,
        encryptionKey
      )
    case 'sqlserver':
    case 'mysql':
    case 'oracle':
    case 'athena':
    case 'snowflake':
    case "monetdb":
    case 'trino':
      throw new Error(`${datasource.type} writeback not implemented`)
  }
}
