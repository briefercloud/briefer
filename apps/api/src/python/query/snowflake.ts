import { v4 as uuidv4 } from 'uuid'
import { SnowflakeDataSource, getDatabaseURL } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import {
  getSQLAlchemySchema,
  makeSQLAlchemyQuery,
  pingSQLAlchemy,
} from './sqlalchemy.js'
import { OnTable } from '../../datasources/structure.js'

export async function makeSnowflakeQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: SnowflakeDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: 'snowflake', data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    'snowflake',
    jobId,
    query,
    queryId,
    onProgress
  )
}

export function pingSnowflake(
  ds: SnowflakeDataSource,
  encryptionKey: string
): Promise<null | Error> {
  return pingSQLAlchemy({ type: 'snowflake', data: ds }, encryptionKey, null)
}

export function getSnowflakeSchema(
  ds: SnowflakeDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<void> {
  return getSQLAlchemySchema(
    { type: 'snowflake', data: ds },
    encryptionKey,
    null,
    onTable
  )
}
