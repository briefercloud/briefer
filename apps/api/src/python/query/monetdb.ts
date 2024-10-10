import { v4 as uuidv4 } from 'uuid'
import {
  MonetDBDataSource,
  getDatabaseURL,
} from '@briefer/database'
import {
  DataSourceStructure,
  RunQueryResult,
  SuccessRunQueryResult,
} from '@briefer/types'
import {
  getSQLAlchemySchema,
  makeSQLAlchemyQuery,
  pingSQLAlchemy,
} from './sqlalchemy.js'
import { OnTable } from '../../datasources/structure.js'

export async function makeMonetDBQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: MonetDBDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: "monetdb", data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    "monetdb",
    jobId,
    query,
    queryId,
    onProgress
  )
}

export function pingMonetDb(
  ds: MonetDBDataSource,
  encryptionKey: string
): Promise<null | Error> {
  return pingSQLAlchemy({ type: "monetdb", data: ds }, encryptionKey, null)
}

export function getMonetDBSchema(
  ds: MonetDBDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<DataSourceStructure> {
  return getSQLAlchemySchema({ type: "monetdb", data: ds }, encryptionKey, null, onTable)
}
