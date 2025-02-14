import {
  jsonString,
  Output,
  PythonErrorOutput,
  RunQueryResult,
  SuccessRunQueryResult,
} from '@briefer/types'
import { makeQuery } from './index.js'
import { executeCode, PythonExecutionError, renderJinja } from '../index.js'
import { DataSource, getDatabaseURL } from '@briefer/database'
import { z } from 'zod'
import { logger } from '../../logger.js'
import { OnTable, OnTableProgress } from '../../datasources/structure.js'

export async function makeSQLAlchemyQuery(
  workspaceId: string,
  sessionId: string,
  dataframeName: string,
  databaseUrl: string,
  dataSourceType:
    | 'mysql'
    | 'sqlserver'
    | 'oracle'
    | 'psql'
    | 'redshift'
    | 'trino'
    | 'snowflake'
    | 'databrickssql',
  jobId: string,
  query: string,
  queryId: string,
  resultOptions: { pageSize: number; dashboardPageSize: number },
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const renderedQuery = await renderJinja(workspaceId, sessionId, query)
  if (typeof renderedQuery !== 'string') {
    return [
      Promise.resolve({
        ...renderedQuery,
        type: 'python-error',
      }),
      async () => {},
    ]
  }

  const flagFilePath = `/home/jupyteruser/.briefer/query-${jobId}.flag`

  const code = `
def briefer_make_sqlalchemy_query():
    import pandas as pd
    import os
    from sqlalchemy import create_engine
    from sqlalchemy import text
    from sqlalchemy.exc import DatabaseError
    from sqlalchemy.exc import DBAPIError
    import json
    from psycopg2.errors import QueryCanceled
    import time
    from datetime import datetime
    from datetime import timedelta
    import multiprocessing

    print(json.dumps({"type": "log", "message": "Starting SQLAlchemy query"}))

    def rename_duplicates(df):
        """Renames duplicate columns in a DataFrame by appending a suffix."""
        new_cols = []
        col_counts = {}  # Dictionary to track the count of column names
        for col in df.columns:
            if col in col_counts:
                col_counts[col] += 1
                new_col = f"{col}_{col_counts[col]}"  # Append count to column name
            else:
                col_counts[col] = 0
                new_col = col
            new_cols.append(new_col)
        df.columns = new_cols
        return df

    dump_file_base = f'/home/jupyteruser/.briefer/query-${queryId}'
    parquet_file_path = f'{dump_file_base}.parquet.gzip'
    csv_file_path = f'{dump_file_base}.csv'

    def convert_df(df):
      for column in df.columns:
          col_type = df[column].dtype
          if col_type == 'object':
              # check if string
              # find out if all non-null values are strings
              are_all_non_null_values_strings = True
              is_memoryview = False
              is_bytes = False
              for value in df[column].dropna():
                  if isinstance(value, memoryview):
                      is_memoryview = True
                      break
                  if isinstance(value, bytes):
                      is_bytes = True
                      break
                  if not isinstance(value, str):
                      are_all_non_null_values_strings = False
                      break

              if is_memoryview or is_bytes:
                  # convert to string
                  df[column] = df[column].apply(lambda x: str(x.tobytes() if is_memoryview else x) if x is not None else None)

                  continue

              if are_all_non_null_values_strings:
                  continue

              try:
                  # Attempt to serialize data as JSON string
                  df[column] = df[column].apply(lambda x: json.dumps(x))
              except:
                  # If all fails, convert to string
                  df[column] = df[column].astype(str)
      return df

    def run_query(queue, engine, job_id, datasource_type, flag_file_path):
        aborted = False
        try:
            # if oracle, initialize the oracle client
            if datasource_type == "oracle":
                import oracledb
                oracledb.init_oracle_client()

            try:
                with engine.connect() as conn:
                    print(json.dumps({"type": "log", "message": "Running query"}))
                    chunks = pd.read_sql_query(text(${JSON.stringify(
                      renderedQuery
                    )}), con=conn, chunksize=100000)
                    page_size = ${resultOptions.pageSize}
                    dashboard_page_size = ${resultOptions.dashboardPageSize}
                    actual_page_size = max(page_size, dashboard_page_size)
                    rows = None
                    columns = None
                    last_emitted_at = 0
                    count = 0
                    df = pd.DataFrame()
                    print(json.dumps({"type": "log", "message": "Iterating over chunks"}))
                    for chunk in chunks:
                        if not os.path.exists(flag_file_path):
                            aborted = True
                            break

                        count += len(chunk)
                        print(json.dumps({"type": "log", "message": f"Got chunk {len(chunk)} rows"}))
                        chunk = rename_duplicates(chunk)
                        df = convert_df(pd.concat([df, chunk], ignore_index=True))
                        if rows is None:
                            rows = json.loads(df.head(actual_page_size).to_json(orient='records', date_format="iso"))

                            # convert all values to string to make sure we preserve the python values
                            # when displaying this data in the browser
                            for row in rows:
                                for key in row:
                                    row[key] = str(row[key])

                        if columns is None:
                            columns = [{"name": col, "type": dtype.name} for col, dtype in chunk.dtypes.items()]

                        for col in columns:
                            if col["name"] not in chunk.columns:
                                continue

                            categories = col.get("categories", [])
                            if len(categories) >= 1000:
                                continue

                            dtype = chunk[col["name"]].dtype
                            if pd.api.types.is_string_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
                                try:
                                    chunk_categories = chunk[col["name"]].dropna().unique()
                                    categories.extend(list(chunk_categories))

                                    # use dict.fromkeys instead of set to keep the order
                                    categories = list(dict.fromkeys(categories))

                                    categories = categories[:1000]
                                    col["categories"] = categories
                                except:
                                    pass

                        # only emit every 1 second
                        now = time.time()
                        if now - last_emitted_at > 1:
                            result = {
                                "version": 3,

                                "type": "success",
                                "columns": columns,
                                "rows": rows[:page_size],
                                "count": count,

                                "page": 0,
                                "pageSize": page_size,
                                "pageCount": int(len(df) // page_size + 1),

                                "dashboardPage": 0,
                                "dashboardPageSize": dashboard_page_size,
                                "dashboardPageCount": int(len(df) // dashboard_page_size + 1),
                                "dashboardRows": rows[:dashboard_page_size],
                            }
                            print(json.dumps(result, ensure_ascii=False, default=str))
                            last_emitted_at = now

                    duration_ms = None
                    # query trino to get query execution time
                    if datasource_type == "trino":
                        start_time = datetime.now()

                        while datetime.now() - start_time < timedelta(seconds=5):
                            try:
                                execution_time_query = f"""
                                SELECT created, "end"
                                FROM system.runtime.queries
                                WHERE query LIKE '%{job_id}%'
                                """
                                result = conn.execute(text(execution_time_query)).fetchone()
                                if not result[1]:
                                    print(json.dumps({"type": "log", "message": f"Query execution time not available yet"}))
                                    time.sleep(0.2)
                                    continue

                                time_span = result[1] - result[0]
                                duration_ms = int(time_span.total_seconds() * 1000)
                                break
                            except Exception as e:
                                print(json.dumps({"type": "log", "message": f"Failed to get query execution time: {str(e)}"}))
                                break


                    # make sure .briefer directory exists
                    os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)

                    # write to parquet
                    print(json.dumps({"type": "log", "message": f"Dumping {len(df)} rows as parquet."}))
                    df.to_parquet(parquet_file_path, compression='gzip', index=False)

                    # write to csv
                    print(json.dumps({"type": "log", "message": f"Dumping {len(df)} rows as csv."}))
                    df.to_csv(csv_file_path, index=False)

                    if aborted or not os.path.exists(flag_file_path):
                        print(json.dumps({"type": "log", "message": f"Query aborted 1 {aborted} {os.path.exists(flag_file_path)}"}))
                        result = {
                            "type": "abort-error",
                            "message": "Query aborted",
                        }
                        print(json.dumps(result, default=str))
                        return

                    result = {
                        "version": 3,

                        "type": "success",
                        "columns": columns,
                        "rows": rows[:page_size],
                        "count": count,

                        "page": 0,
                        "pageSize": 50,
                        "pageCount": int(len(df) // page_size + 1),

                        "dashboardPage": 0,
                        "dashboardPageSize": dashboard_page_size,
                        "dashboardPageCount": int(len(df) // dashboard_page_size + 1),

                        "queryDurationMs": duration_ms,
                    }
                    print(json.dumps(result, ensure_ascii=False, default=str))
                queue.put(None)
            except (DatabaseError, DBAPIError) as e:
                if isinstance(e.__cause__, QueryCanceled):
                    error = {
                        "type": "abort-error",
                        "message": "Query aborted",
                    }
                    print(json.dumps(error, default=str))
                else:
                    error = {
                        "type": "syntax-error",
                        "message": str(e)
                    }
                    print(json.dumps(error, default=str))
                queue.put(None)
        except Exception as e:
            queue.put(e)


    job_id = ${JSON.stringify(jobId)}
    datasource_type = ${JSON.stringify(dataSourceType)}
    flag_file_path = ${JSON.stringify(flagFilePath)}
    print(json.dumps({"type": "log", "message": "Connecting to database"}))
    engine = create_engine(${JSON.stringify(databaseUrl)})

    process = None
    def abort():
        print(json.dumps({"type": "log", "message": "Query aborted 2"}))
        result = {
            "type": "abort-error",
            "message": "Query aborted",
        }
        print(json.dumps(result, default=str))
        if process is not None and process.is_alive():
            process.terminate()
            process.join()

    try:
        os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)
        print(json.dumps({"type": "log", "message": "Creating flag file"}))
        open(flag_file_path, "a").close()

        queue = multiprocessing.Queue()
        process = multiprocessing.Process(target=run_query, args=(queue, engine, job_id, datasource_type, flag_file_path))
        process.start()

        while process.is_alive():
            print(json.dumps({"type": "log", "message": "Outer process, waiting for inner process to finish"}))
            if not os.path.exists(flag_file_path):
                print(json.dumps({"type": "log", "message": "Outer process detected that flag file does not exist, aborting query"}))
                abort()
                break
            time.sleep(0.5)
        result = queue.get_nowait()
        if result and isinstance(result, Exception):
            raise result
    except KeyboardInterrupt:
        print(json.dumps({"type": "log", "message": "Outer process caught KeyboardInterrupt"}))
        abort()
    finally:
        print(json.dumps({"type": "log", "message": "Disposing of engine"}))
        engine.dispose()
        if os.path.exists(flag_file_path):
            print(json.dumps({"type": "log", "message": "Removing flag file"}))
            os.remove(flag_file_path)

briefer_make_sqlalchemy_query()`

  return makeQuery(
    workspaceId,
    sessionId,
    dataframeName,
    queryId,
    code,
    flagFilePath,
    onProgress
  )
}

export async function pingSQLAlchemy(
  ds: DataSource,
  encryptionKey: string,
  credentialsInfo: object | null
): Promise<null | Error> {
  const databaseUrl = await getDatabaseURL(ds, encryptionKey)
  const query = ds.type === 'oracle' ? 'SELECT 1 FROM DUAL' : 'SELECT 1'

  const code = `import json
from sqlalchemy import create_engine
from sqlalchemy.sql.expression import text

# if oracle, initialize the oracle client
if ${JSON.stringify(ds.type)} == "oracle":
    import oracledb
    oracledb.init_oracle_client()


credentials_info = json.loads(${JSON.stringify(
    JSON.stringify(credentialsInfo)
  )})
if credentials_info:
    engine = create_engine(${JSON.stringify(
      databaseUrl
    )}, credentials_info=credentials_info)
else:
    engine = create_engine(${JSON.stringify(databaseUrl)})

try:
    with engine.connect() as conn:
        conn.execute(text(${JSON.stringify(query)})).fetchall()
finally:
    engine.dispose()`

  let pythonError: PythonErrorOutput | null = null
  return executeCode(
    ds.data.workspaceId,
    `ping-${ds.type}-${ds.data.id}`,
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

export async function getSQLAlchemySchema(
  ds: DataSource,
  encryptionKey: string,
  credentialsInfo: object | null,
  onTable: OnTable
): Promise<void> {
  const databaseUrl = await getDatabaseURL(ds, encryptionKey)

  const code = `
import csv
import json
from sqlalchemy import create_engine
from sqlalchemy import inspect
from sqlalchemy import text

class BrieferAggregateException(Exception):
    def __init__(self, exceptions):
        self.exceptions = exceptions

    def __str__(self):
        return f"Got {len(self.exceptions)} exceptions: {self.exceptions}"

    def __iter__(self):
        return iter(self.exceptions)



def get_columns(engine, inspector, table_name, schema_name):
    if ${JSON.stringify(ds.type)} == "redshift":
        with engine.connect() as conn:
            result = []
            exceptions = []

            try:
                # Query schema for all tables (internal and external)
                columns_query = """
                    SELECT column_name, data_type
                    FROM svv_columns
                    WHERE table_schema = :schema
                      AND table_name = :table
                    ORDER BY ordinal_position
                """
                columns = conn.execute(
                    text(columns_query),
                    {"schema": schema_name, "table": table_name}
                ).fetchall()

                for column in columns:
                    try:
                        result.append({
                            "name": column[0],
                            "type": column[1]
                        })
                    except Exception as e:
                        print(json.dumps({"log": f"Failed to parse column: {str(e)}"}))
                        exceptions.append(e)
                        continue

                if not result and exceptions:
                    raise BrieferAggregateException(exceptions)

                return result

            except Exception as e:
                conn.execute(text("ROLLBACK"))
                raise e

    return inspector.get_columns(table_name, schema=schema_name)

def schema_from_tables(engine, inspector, tables, default_schema):
    made_progress = False
    exceptions = []
    for table in tables:
        schema_name, table_name = table.split(".")
        print(json.dumps({"log": f"Getting schema for table {table}"}))
        columns = []
        try:
            for column in get_columns(engine, inspector, table_name, schema_name):
                columns.append({
                    "name": column["name"],
                    "type": str(column["type"])
                })
        except Exception as e:
            print(json.dumps({"log": f"Got error when trying to get columns for table {table}: {str(e)}"}))
            exceptions.append(e)
            continue

        made_progress = True
        progress = {
            "type": "progress",
            "schema": schema_name,
            "tableName": table_name,
            "table": {
                "columns": columns
            },
            "defaultSchema": default_schema
        }
        print(json.dumps(progress, default=str))

    if not made_progress and len(exceptions) > 0:
        raise BrieferAggregateException(exceptions)


def get_data_source_structure(data_source_id, credentials_info=None):
    if credentials_info:
        engine = create_engine(f"${databaseUrl}", credentials_info=credentials_info)
    else:
        engine = create_engine(f"${databaseUrl}")

    try:
        # if oracle, initialize the oracle client
        if ${JSON.stringify(ds.type)} == "oracle":
            import oracledb
            oracledb.init_oracle_client()

        inspector = inspect(engine)

        default_schema = "public"
        try:
            default_schema = inspector.default_schema_name or default_schema
        except:
            pass

        if ${JSON.stringify(ds.type)} == "bigquery":
            tables = inspector.get_table_names()
            schema_from_tables(engine, inspector, tables, default_schema)
        else:
            tables = []
            exceptions = []
            for schema_name in inspector.get_schema_names():
                print(json.dumps({"log": f"Getting table names for schema {schema_name}"}))
                try:
                    schema_tables = inspector.get_table_names(schema=schema_name)
                    tables += [f"{schema_name}.{table}" for table in schema_tables]
                except Exception as e:
                    exceptions.append(e)
                    print(json.dumps({"log": f"Failed to get tables for schema {schema_name}: {str(e)}"}))
                    continue

                if len(tables) >= 20:
                    schema_from_tables(engine, inspector, tables, default_schema)
                    tables = []

            schema_from_tables(engine, inspector, tables, default_schema)
            if len(tables) == 0 and len(exceptions) > 0:
                raise BrieferAggregateException(exceptions)
    finally:
        engine.dispose()

credentials_info = json.loads(${JSON.stringify(
    JSON.stringify(credentialsInfo)
  )})
get_data_source_structure("${ds.data.id}", credentials_info)`

  let pythonError: PythonErrorOutput | null = null
  const onError = (output: PythonErrorOutput) => {
    pythonError = output
  }

  let gotOutput = false
  return executeCode(
    ds.data.workspaceId,
    `schema-${ds.type}-${ds.data.id}`,
    code,
    (outputs) => {
      gotOutput = true
      onSchemaOutputs(ds, outputs, onError, onTable)
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
          `Failed to get schema for datasource ${ds.data.id}. Got no output.`
        )
      }
    })
}

export function onSchemaOutputs(
  ds: DataSource,
  outputs: Output[],
  onError: (output: PythonErrorOutput) => void,
  onTable: OnTable
) {
  for (const output of outputs) {
    if (output.type === 'stdio' && output.name === 'stdout') {
      const lines = output.text.split('\n')
      for (const line of lines) {
        if (line === '') {
          continue
        }

        const parsedStructure = jsonString
          .pipe(z.union([OnTableProgress, z.object({ log: z.string() })]))
          .safeParse(line)
        if (parsedStructure.success) {
          if ('log' in parsedStructure.data) {
            logger().trace(
              {
                workspaceId: ds.data.workspaceId,
                datasourceId: ds.data.id,
              },
              parsedStructure.data.log
            )
          } else {
            onTable(
              parsedStructure.data.schema,
              parsedStructure.data.tableName,
              parsedStructure.data.table,
              parsedStructure.data.defaultSchema
            )
          }
        } else {
          logger().error(
            {
              workspaceId: ds.data.workspaceId,
              datasourceId: ds.data.id,
              err: parsedStructure.error,
              line,
            },
            'Failed to parse line from SQLAlchemy schema output'
          )
        }
      }
    } else if (output.type === 'error') {
      onError(output)
    } else {
      logger().warn(
        {
          workspaceId: ds.data.workspaceId,
          datasourceId: ds.data.id,
          output,
        },
        'Unexpected output type from SQLAlchemy schema query'
      )
    }
  }
}
