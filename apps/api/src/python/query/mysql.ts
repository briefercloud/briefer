import { v4 as uuidv4 } from 'uuid'
import { MySQLDataSource, getDatabaseURL } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import { makeSQLAlchemyQuery, pingSQLAlchemy } from './sqlalchemy.js'

export function pingMySQL(
  ds: MySQLDataSource,
  encryptionKey: string
): Promise<null | Error> {
  return pingSQLAlchemy({ type: 'mysql', data: ds }, encryptionKey, null)
}

export async function makeMySQLQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: MySQLDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: 'mysql', data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    'mysql',
    jobId,
    query,
    queryId,
    onProgress
  )
}
