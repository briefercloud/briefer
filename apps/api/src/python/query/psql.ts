import { v4 as uuidv4 } from 'uuid'
import {
  PostgreSQLDataSource,
  RedshiftDataSource,
  getDatabaseURL,
} from '@briefer/database'
import {
  DataSourceStructure,
  PythonErrorOutput,
  RunQueryResult,
  SuccessRunQueryResult,
  jsonString,
} from '@briefer/types'
import { makeSQLAlchemyQuery } from './sqlalchemy.js'
import { PythonExecutionError, executeCode } from '../index.js'
import { logger } from '../../logger.js'
import { z } from 'zod'

export async function makePSQLQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: PostgreSQLDataSource | RedshiftDataSource,
  type: 'psql' | 'redshift',
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseUrl = await getDatabaseURL(
    { type, data: datasource },
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

export async function pingPSQL(
  ds: PostgreSQLDataSource | RedshiftDataSource,
  type: 'psql' | 'redshift',
  encryptionKey: string
): Promise<null | Error> {
  const databaseUrl = await getDatabaseURL({ type, data: ds }, encryptionKey)

  const code = `from sqlalchemy import create_engine
from sqlalchemy.sql.expression import text

engine = create_engine(${JSON.stringify(databaseUrl)})
connection = engine.connect()

connection.execute(text("SELECT 1")).fetchall()`

  let pythonError: PythonErrorOutput | null = null
  return executeCode(
    ds.workspaceId,
    `ping-psql-${ds.id}`,
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

export async function getPSQLSchema(
  ds: PostgreSQLDataSource | RedshiftDataSource,
  type: 'psql' | 'redshift',
  encryptionKey: string
): Promise<DataSourceStructure> {
  const databaseUrl = await getDatabaseURL({ type, data: ds }, encryptionKey)

  const code = `
import json
from sqlalchemy import create_engine
from sqlalchemy import inspect


def get_data_source_structure(data_source_id):
    engine = create_engine(f"${databaseUrl}")
    schemas = {}
    inspector = inspect(engine)
    for schema_name in inspector.get_schema_names():
        print(json.dumps({"log": f"Getting tables for schema {schema_name}"}))
        tables = {}
        for table_name in inspector.get_table_names(schema=schema_name):
            print(json.dumps({"log": f"Getting schema for table {table_name}"}))
            columns = []
            for column in inspector.get_columns(table_name, schema=schema_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"])
                })
            tables[table_name] = {
                "columns": columns
            }
        schemas[schema_name] = {
            "tables": tables
        }

    data_source_structure = {
        "dataSourceId": data_source_id,
        "schemas": schemas,
        "defaultSchema": "public"
    }

    return data_source_structure


structure = get_data_source_structure("${ds.id}")
print(json.dumps(structure, default=str))`

  let pythonError: PythonErrorOutput | null = null
  let structure: DataSourceStructure | null = null
  return executeCode(
    ds.workspaceId,
    `schema-psql-${ds.id}`,
    code,
    (outputs) => {
      for (const output of outputs) {
        if (output.type === 'stdio' && output.name === 'stdout') {
          const lines = output.text.split('\n')
          for (const line of lines) {
            if (line === '') {
              continue
            }

            const parsedStructure = jsonString
              .pipe(
                z.union([DataSourceStructure, z.object({ log: z.string() })])
              )
              .safeParse(line)
            if (parsedStructure.success) {
              if ('log' in parsedStructure.data) {
                logger.trace(
                  {
                    workspaceId: ds.workspaceId,
                    datasourceId: ds.id,
                  },
                  parsedStructure.data.log
                )
              } else {
                structure = parsedStructure.data
              }
            } else {
              logger.error(
                {
                  workspaceId: ds.workspaceId,
                  datasourceId: ds.id,
                  err: parsedStructure.error,
                  line,
                },
                'Failed to parse line from PSQL schema output'
              )
            }
          }
        } else if (output.type === 'error') {
          pythonError = output
        } else {
          logger.error(
            {
              workspaceId: ds.workspaceId,
              datasourceId: ds.id,
              output,
            },
            'Unexpected output type from PSQL schema query'
          )
        }
      }
    },
    { storeHistory: false }
  )
    .then(({ promise }) => promise)
    .then(() => {
      if (structure) {
        return structure
      }

      if (pythonError) {
        throw new PythonExecutionError(
          pythonError.type,
          pythonError.ename,
          pythonError.evalue,
          []
        )
      }

      throw new Error(
        `Failed to get schema for datasource ${ds.id}. Got no output.`
      )
    })
}
