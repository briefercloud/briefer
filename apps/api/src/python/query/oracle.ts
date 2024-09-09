import { v4 as uuidv4 } from 'uuid'
import { OracleDataSource, getDatabaseURL } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import { makeSQLAlchemyQuery } from './sqlalchemy.js'

export async function makeOracleQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: OracleDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: 'oracle', data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    jobId,
    query,
    queryId,
    onProgress
  )
}
