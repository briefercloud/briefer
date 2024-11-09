import { DataSource } from '@briefer/database'
import { executeCode } from '../index.js'
import {
  DataFrame,
  DataFrameColumn,
  DataFrameStringColumn,
  RunQueryResult,
  SQLQueryConfiguration,
  SuccessRunQueryResult,
  jsonString,
} from '@briefer/types'
import { logger } from '../../logger.js'
import { z } from 'zod'
import { makePSQLQuery } from './psql.js'
import { makeBigQueryQuery } from './bigquery.js'
import { makeAthenaQuery } from './athena.js'
import { makeOracleQuery } from './oracle.js'
import { makeDuckDBQuery } from './duckdb.js'
import { makeMySQLQuery } from './mysql.js'
import { makeTrinoQuery } from './trino.js'
import { makeSnowflakeQuery } from './snowflake.js'
import { updateConnStatus } from '../../datasources/index.js'
import { getJupyterManager } from '../../jupyter/index.js'
import { makeSQLServerQuery } from './sqlserver.js'
import { makeDatabricksSQLQuery } from './databrickssql.js'

export async function makeSQLQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: DataSource | 'duckdb',
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void,
  configuration: SQLQueryConfiguration | null
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  if (datasource === 'duckdb') {
    return makeDuckDBQuery(
      workspaceId,
      sessionId,
      queryId,
      dataframeName,
      sql,
      onProgress
    )
  }

  let result: [Promise<RunQueryResult>, () => Promise<void>]
  switch (datasource.type) {
    case 'psql':
    case 'redshift':
      result = await makePSQLQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        datasource.type,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'bigquery':
      result = await makeBigQueryQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'athena':
      result = await makeAthenaQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress,
        configuration
      )
      break
    case 'oracle':
      result = await makeOracleQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'sqlserver':
      result = await makeSQLServerQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'mysql': {
      result = await makeMySQLQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    }
    case 'trino':
      result = await makeTrinoQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'snowflake':
      result = await makeSnowflakeQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
    case 'databrickssql':
      result = await makeDatabricksSQLQuery(
        workspaceId,
        sessionId,
        queryId,
        dataframeName,
        datasource.data,
        encryptionKey,
        sql,
        onProgress
      )
      break
  }

  result[0].then(async (r) => {
    if (r.type === 'success') {
      await updateConnStatus(
        { config: datasource },
        {
          connStatus: 'online',
          lastConnection: new Date(),
        }
      )
    }
  })

  return result
}

export async function makeQuery(
  workspaceId: string,
  sessionId: string,
  dataframeName: string,
  queryId: string,
  code: string,
  flagFilePath: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  let error: Error | null = null
  let result: RunQueryResult | null = null
  let aborted = false

  const abortFns: (() => Promise<void>)[] = []
  const { promise: queryPromise, abort: abortQuery } = await executeCode(
    workspaceId,
    sessionId,
    code,
    (outputs) => {
      if (error || aborted) {
        return
      }

      for (const output of outputs) {
        if (output.type === 'stdio' && output.name === 'stdout') {
          const lines = output.text.trim().split('\n')
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.trim())
              switch (parsed.type) {
                case 'success':
                  onProgress(parsed)
                  result = parsed
                  break
                case 'syntax-error':
                  result = parsed
                  break
                case 'abort-error':
                  result = parsed
                  aborted = true
                  break
                case 'log':
                  logger().debug(
                    {
                      workspaceId,
                      sessionId,
                      queryId,
                      log: parsed,
                    },
                    `Got log message while running query`
                  )
                  break
                default:
                  error = new Error('Unexpected output: ' + line)
              }
            } catch {}
          }
        }

        if (output.type === 'error') {
          result = {
            type: 'python-error',
            ename: output.ename,
            evalue: output.evalue,
            traceback: output.traceback,
          }
        }
      }
    },
    { storeHistory: false }
  )
  abortFns.push(abortQuery)

  const resultPromise = queryPromise.then(async (): Promise<RunQueryResult> => {
    if (aborted) {
      return {
        type: 'abort-error',
        message: 'Query aborted',
      }
    }

    if (error) {
      throw error
    }

    if (!result) {
      throw new Error('No result')
    }

    if (result.type !== 'success') {
      return result
    }

    const code = `
def _briefer_read_query():
    import pandas as pd
    retries = 3
    while retries > 0:
        try:
            return pd.read_parquet("/home/jupyteruser/.briefer/query-${queryId}.parquet.gzip")
        except:
            retries -= 1
            if retries == 0:
                raise
            else:
                import time
                time.sleep(1)

${dataframeName} = _briefer_read_query()
del _briefer_read_query`

    const { promise: dataframePromise, abort: abortDataframe } =
      await executeCode(
        workspaceId,
        sessionId,
        code,
        (outputs) => {
          for (const output of outputs) {
            if (output.type === 'error') {
              result = {
                type: 'python-error',
                ename: output.ename,
                evalue: output.evalue,
                traceback: output.traceback,
              }
            }
          }
        },
        { storeHistory: false }
      )

    abortFns.push(abortDataframe)

    if (aborted) {
      await abortDataframe()
      return {
        type: 'abort-error',
        message: 'Query aborted',
      }
    }

    await dataframePromise
    return result
  })

  const abortFunction = async () => {
    aborted = true
    await Promise.all([
      getJupyterManager().deleteFile(workspaceId, flagFilePath),
      ...abortFns.map((fn) => fn()),
    ])

    await queryPromise
  }

  return [resultPromise, abortFunction]
}

export async function readDataframePage(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  page: number,
  pageSize: number
): Promise<RunQueryResult | null> {
  const code = `import json

if not ("${dataframeName}" in globals()):
  import pandas as pd
  try:
    ${dataframeName} = pd.read_parquet("/home/jupyteruser/.briefer/query-${queryId}.parquet.gzip")
  except:
    print(json.dumps({"type": "not-found"}))

if "${dataframeName}" in globals():
  start = ${page * pageSize}
  end = (${page} + 1) * ${pageSize}
  rows = ${dataframeName}.iloc[start:end].to_json(
    orient="records", date_format="iso"
  )
  columns = [{"name": col, "type": dtype.name} for col, dtype in ${dataframeName}.dtypes.items()]
  result = {
    "type": "success",
    "rows": json.loads(rows),
    "count": len(${dataframeName}),
    "columns": columns
  }
  print(json.dumps(result))`

  let result: RunQueryResult | null = null
  let error: Error | null = null
  await (
    await executeCode(
      workspaceId,
      sessionId,
      code,
      (outputs) => {
        if (error) {
          return
        }

        for (const output of outputs) {
          if (output.type === 'stdio' && output.name === 'stdout') {
            const lines = output.text.trim().split('\n')
            for (const line of lines) {
              const parsed = JSON.parse(line.trim())
              switch (parsed.type) {
                case 'success':
                  result = parsed
                  break
                case 'not-found':
                  result = null
                  break
                default:
                  error = new Error('Unexpected output: ' + line)
              }
            }
          }

          if (output.type === 'error') {
            result = {
              type: 'python-error',
              ename: output.ename,
              evalue: output.evalue,
              traceback: output.traceback,
            }
          }
        }
      },
      { storeHistory: false }
    )
  ).promise

  if (error) {
    throw error
  }

  return result
}

export async function renameDataFrame(
  workspaceId: string,
  sessionId: string,
  currentName: string,
  newName: string
) {
  const code = `if "${newName}" != "${currentName}":
    ${newName} = ${currentName}
    del ${currentName}`

  return (
    await executeCode(workspaceId, sessionId, code, () => {}, {
      storeHistory: false,
    })
  ).promise
}

export async function listDataFrames(
  workspaceId: string,
  sessionId: string
): Promise<DataFrame[]> {
  const code = `
def _briefer_list_dataframes():
    import pandas as pd
    import json
    dataframes = []

    names = %who_ls
    for name in names:
        try:
            if isinstance(globals()[name], pd.DataFrame):
                df = globals()[name]
                columns = [{"name": str(col), "type": dtype.name} for col, dtype in df.dtypes.items()]

                for col in columns:
                    # Ignore if the column already has categories
                    if "categories" in col:
                        continue

                    dtype = df[col["name"]].dtype
                    if pd.api.types.is_string_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
                        try:
                            categories = df[col["name"]].dropna().unique()
                            categories = list(categories)
                            categories = list(dict.fromkeys(categories))
                            categories = categories[:1000] 
                            col["categories"] = categories
                        except:
                            pass

                dataframes.append({"name": name, "columns": columns})
        except Exception as e:
            pass

    print(json.dumps(dataframes, default=str))

_briefer_list_dataframes()
del _briefer_list_dataframes`

  let dataframes: DataFrame[] = []
  let error: Error | null = null
  await (
    await executeCode(
      workspaceId,
      sessionId,
      code,
      (outputs) => {
        if (error) {
          return
        }

        for (const output of outputs) {
          if (output.type === 'stdio' && output.name === 'stdout') {
            const lines = output.text.trim().split('\n')
            for (const line of lines) {
              const parsed = jsonString
                .pipe(
                  z.array(
                    z
                      .object({ columns: z.array(z.object({}).passthrough()) })
                      .passthrough()
                  )
                )
                .safeParse(line.trim())
              if (!parsed.success) {
                logger().error(
                  {
                    workspaceId,
                    sessionId,
                    line,
                    error: parsed.error,
                  },
                  'Failed to parse listDataFrames output line'
                )
                continue
              }

              for (const rawDf of parsed.data) {
                const parsed = DataFrame.safeParse({
                  ...rawDf,
                  // we'll parse columns one by one
                  columns: [],
                })
                if (!parsed.success) {
                  logger().error(
                    {
                      workspaceId,
                      sessionId,
                      rawDf,
                      error: parsed.error,
                    },
                    'Failed to parse DataFrame, ignoring it'
                  )
                  continue
                }

                const df = parsed.data

                const columns: DataFrameColumn[] = []
                for (const rawColumn of rawDf.columns) {
                  let parsed = DataFrameColumn.safeParse(rawColumn)
                  if (!parsed.success) {
                    logger().error(
                      {
                        workspaceId,
                        sessionId,
                        rawColumn,
                        error: parsed.error,
                        df,
                      },
                      'Failed to parse DataFrameColumn, trying string type'
                    )
                    parsed = DataFrameStringColumn.safeParse({
                      ...rawColumn,
                      type: 'string',
                    })
                    if (!parsed.success) {
                      logger().error(
                        {
                          workspaceId,
                          sessionId,
                          rawColumn,
                          error: parsed.error,
                          df,
                        },
                        'Failed to parse column as string, ignoring it'
                      )
                      continue
                    }
                    columns.push(parsed.data)
                  } else {
                    columns.push(parsed.data)
                  }
                }
                df.columns = columns

                dataframes.push({
                  ...df,
                  updatedAt: new Date().toISOString(),
                })
              }
            }
          }

          if (output.type === 'error') {
            error = new Error(
              `Error listing dataframes: ${output.ename}: ${output.evalue}`
            )
          }
        }
      },
      { storeHistory: false }
    )
  ).promise

  if (error) {
    throw error
  }

  return dataframes
}
