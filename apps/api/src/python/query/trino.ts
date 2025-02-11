import { v4 as uuidv4 } from 'uuid'
import { TrinoDataSource, getDatabaseURL } from '@briefer/database'
import {
  PythonErrorOutput,
  RunQueryResult,
  SuccessRunQueryResult,
} from '@briefer/types'
import { makeSQLAlchemyQuery, onSchemaOutputs } from './sqlalchemy.js'
import { PythonExecutionError, executeCode } from '../index.js'
import { OnTable } from '../../datasources/structure.js'

export async function makeTrinoQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: TrinoDataSource,
  encryptionKey: string,
  sql: string,
  resultOptions: { pageSize: number; dashboardPageSize: number },
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type: 'trino', data: datasource },
    encryptionKey
  )

  const jobId = uuidv4()
  const query = `${sql}  -- Briefer jobId: ${jobId}`

  return makeSQLAlchemyQuery(
    workspaceId,
    sessionId,
    dataframeName,
    databaseUrl,
    'trino',
    jobId,
    query,
    queryId,
    resultOptions,
    onProgress
  )
}

export async function pingTrino(
  ds: TrinoDataSource,
  encryptionKey: string
): Promise<null | Error> {
  const databaseUrl = await getDatabaseURL(
    { type: 'trino', data: ds },
    encryptionKey
  )

  const code = `from sqlalchemy import create_engine
from sqlalchemy.sql.expression import text

engine = create_engine(${JSON.stringify(databaseUrl)})
connection = engine.connect()

connection.execute(text("SELECT 1")).fetchall()`

  let pythonError: PythonErrorOutput | null = null
  return executeCode(
    ds.workspaceId,
    `ping-trino-${ds.id}`,
    code,
    (outputs) => {
      for (const output of outputs) {
        if (output.type === 'error') {
          pythonError = output
        }
      }
    },
    { storeHistory: false }
  )
    .then(({ promise }) => promise)
    .then(() => {
      if (!pythonError) {
        return null
      }

      return new PythonExecutionError(
        pythonError.type,
        pythonError.ename,
        pythonError.evalue,
        []
      )
    })
}

export async function getTrinoSchema(
  ds: TrinoDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<void> {
  const databaseUrl = await getDatabaseURL(
    { type: 'trino', data: ds },
    encryptionKey
  )

  const singleCatalog = ds.catalog !== null && ds.catalog !== ''

  const code = `
import json
from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy.sql.expression import text

def get_catalog_structure(catalog):
    if catalog:
        engine = create_engine(f"${databaseUrl}{catalog}")
    else:
        engine = create_engine(f"${databaseUrl}")

    inspector = inspect(engine)
    for schema_name in inspector.get_schema_names():
        actual_schema_name = schema_name if catalog is None else f"{catalog}.{schema_name}"

        print(json.dumps({"log": f"Getting tables for schema {actual_schema_name}"}))
        for table_name in inspector.get_table_names(schema=schema_name):
            print(json.dumps({"log": f"Getting schema for table {table_name}"}))
            columns = []
            for column in inspector.get_columns(table_name, schema=schema_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"])
                })

            progress = {
                "type": "progress",
                "schema": actual_schema_name,
                "tableName": table_name,
                "table": {
                    "columns": columns
                },
                "defaultSchema": ""
            }
            print(json.dumps(progress, default=str))

catalogs_to_ignore = set(['jmx', 'system', 'memory'])
def get_data_source_structure(data_source_id, single_catalog):
    if single_catalog:
        get_catalog_structure(None)
    else:
        engine = create_engine("${databaseUrl}")
        conn = engine.connect()
        catalogs = [row[0] for row in conn.execute(text("SHOW CATALOGS")).fetchall()]

        for catalog in catalogs:
            if catalog in catalogs_to_ignore:
                continue
            print(json.dumps({"log": f"Getting schema for catalog {catalog}"}))
            try:
                get_catalog_structure(catalog)
            except:
                raise


get_data_source_structure("${ds.id}", ${singleCatalog ? 'True' : 'False'})`

  let pythonError: PythonErrorOutput | null = null
  const onError = (output: PythonErrorOutput) => {
    pythonError = output
  }

  let gotOutput = false
  return executeCode(
    ds.workspaceId,
    `schema-trino-${ds.id}`,
    code,
    (outputs) => {
      gotOutput = true
      onSchemaOutputs({ type: 'trino', data: ds }, outputs, onError, onTable)
    },
    { storeHistory: false }
  )
    .then(({ promise }) => promise)
    .then(() => {
      if (pythonError) {
        throw new PythonExecutionError(
          pythonError.type,
          pythonError.ename,
          pythonError.evalue,
          []
        )
      }

      if (!gotOutput) {
        throw new Error(
          `Failed to get schema for datasource ${ds.id}. Got no output.`
        )
      }
    })
}
