import { v4 as uuidv4 } from 'uuid'
import { DatabricksSQLDataSource, getDatabaseURL } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import {
  getSQLAlchemySchema,
  makeSQLAlchemyQuery,
  pingSQLAlchemy,
} from './sqlalchemy.js'
import { OnTable } from '../../datasources/structure.js'

export async function makeDatabricksSQLQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: DatabricksSQLDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: 'databrickssql', data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    'databrickssql',
    jobId,
    query,
    queryId,
    onProgress
  )
}

export function pingDatabricksSQL(
  ds: DatabricksSQLDataSource,
  encryptionKey: string
): Promise<null | Error> {
  return pingSQLAlchemy(
    { type: 'databrickssql', data: ds },
    encryptionKey,
    null
  )
}

export function getDatabricksSQLSchema(
  ds: DatabricksSQLDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<void> {
  return getSQLAlchemySchema(
    { type: 'databrickssql', data: ds },
    encryptionKey,
    null,
    onTable
  )
}
