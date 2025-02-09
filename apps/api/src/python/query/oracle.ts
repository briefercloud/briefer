import { v4 as uuidv4 } from 'uuid'
import { OracleDataSource, getDatabaseURL } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import {
  getSQLAlchemySchema,
  makeSQLAlchemyQuery,
  pingSQLAlchemy,
} from './sqlalchemy.js'
import { OnTable } from '../../datasources/structure.js'

export async function makeOracleQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: OracleDataSource,
  encryptionKey: string,
  sql: string,
  resultOptions: { pageSize: number; dashboardPageSize: number },
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
    'oracle',
    jobId,
    query,
    queryId,
    resultOptions,
    onProgress
  )
}

export function pingOracle(
  ds: OracleDataSource,
  encryptionKey: string
): Promise<null | Error> {
  return pingSQLAlchemy({ type: 'oracle', data: ds }, encryptionKey, null)
}

export function getOracleSchema(
  ds: OracleDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<void> {
  return getSQLAlchemySchema(
    { type: 'oracle', data: ds },
    encryptionKey,
    null,
    onTable
  )
}
