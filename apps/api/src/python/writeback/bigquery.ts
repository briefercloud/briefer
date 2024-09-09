import { BigQueryDataSource, getCredentials } from '@briefer/database'
import { Writeback } from './index.js'
import { executeCode, renderJinja } from '../index.js'
import { WriteBackResult, jsonString } from '@briefer/types'
import { logger } from '../../logger.js'

export async function writebackBigQuery(
  workspaceId: string,
  sessionId: string,
  dataframeName: string,
  datasource: BigQueryDataSource,
  tableName: string,
  overwriteTable: boolean,
  onConflict: 'update' | 'ignore',
  onConflictColumns: string[],
  encryptionKey: string
): Promise<Writeback> {
  const executedAt = new Date().toISOString()
  const credentials = await getCredentials(datasource, encryptionKey)

  const table = await renderJinja(workspaceId, sessionId, tableName)
  if (typeof table !== 'string') {
    return {
      promise: Promise.resolve({
        _tag: 'error',
        executedAt,
        step: 'validation',
        reason: 'invalid-table-template',
        pythonError: table,
      }),
      abort: async () => {},
    }
  }

  const code = getCode(
    dataframeName,
    table,
    overwriteTable,
    onConflict,
    onConflictColumns,
    credentials
  )

  let result: WriteBackResult | null
  const { promise, abort } = await executeCode(
    workspaceId,
    sessionId,
    code,
    (outputs) => {
      for (const output of outputs) {
        if (result && result._tag === 'success') {
          continue
        }

        switch (output.type) {
          case 'html':
          case 'image':
          case 'plotly':
            result = {
              _tag: 'error',
              executedAt,
              step: 'unknown',
            }
            break
          case 'error':
            result = {
              _tag: 'error',
              executedAt,
              step: 'unknown',
            }
            console.log(`${output.ename}: ${output.evalue}`)
            console.log(output.traceback.join('\n'))

            logger.error(
              {
                workspaceId,
                sessionId,
                dataframeName,
                tableName,
                overwriteTable,
                onConflict,
                error: output,
              },
              `Python error during writeback`
            )
            break
          case 'stdio':
            {
              switch (output.name) {
                case 'stderr':
                  result = {
                    _tag: 'error',
                    executedAt,
                    step: 'unknown',
                  }
                  break
                case 'stdout':
                  const parsed = jsonString
                    .pipe(WriteBackResult)
                    .safeParse(output.text)
                  if (parsed.success) {
                    result =
                      parsed.data._tag === 'success'
                        ? { ...parsed.data, dataSourceId: datasource.id }
                        : parsed.data
                  } else {
                    result = {
                      _tag: 'error',
                      executedAt,
                      step: 'unknown',
                    }

                    logger.error(
                      {
                        workspaceId,
                        sessionId,
                        dataframeName,
                        tableName,
                        overwriteTable,
                        onConflict,
                        output: output.text,
                        error: parsed.error,
                      },
                      `Failed to parse writeback result`
                    )
                  }
                  break
              }
            }
            break
        }
      }
    },
    {
      storeHistory: false,
    }
  )

  return {
    promise: promise.then(() => {
      if (!result) {
        logger.error(
          {
            workspaceId,
            sessionId,
            dataframeName,
            tableName,
            overwriteTable,
            onConflict,
          },
          `No writeback result`
        )
        result = {
          _tag: 'error',
          executedAt,
          step: 'unknown',
        }
      }

      return result
    }),
    abort,
  }
}

function getCode(
  dataframeName: string,
  tableName: string,
  overwriteTable: boolean,
  onConflict: 'update' | 'ignore',
  onConflictColumns: string[],
  credentials: any
): string {
  const code = `
def _briefer_writeback(df, table_name, overwrite_table, on_conflict, on_conflict_columns):
    from google.api_core.exceptions import BadRequest
    from google.api_core.exceptions import NotFound
    from google.api_core.exceptions import PermissionDenied

    try:
        from google.cloud import bigquery
        from google.oauth2 import service_account
        import json
        import datetime

        executed_at = datetime.datetime.now().isoformat()
        step = "validation"

        # check if table_name contains the dataset prefix, split by dot
        if "." not in table_name:
            result = {
                "_tag": "error",
                "step": step,
                "reason": "invalid-table-name",
                "message": "Table name must be in the format dataset.table",
                "executedAt": executed_at
            }
            print(json.dumps(result))
            return

        df_columns = df.columns.tolist()
        # check if all on_conflict_columns are in the dataframe
        if len(df) > 0:
            invalid_columns = [col for col in on_conflict_columns if col not in df_columns]
            if len(invalid_columns) > 0:
                result = {
                    "_tag": "error",
                    "step": step,
                    "reason": "invalid-conflict-columns",
                    "columns": invalid_columns,
                    "executedAt": executed_at
                }
                print(json.dumps(result))
                return

        step = "schema-inspection"

        credentials_info = json.loads(${JSON.stringify(
          JSON.stringify(credentials)
        )})
        credentials = service_account.Credentials.from_service_account_info(credentials_info)
        project_id = credentials_info['project_id']

        table_name = f"{project_id}.{table_name}"
        client = bigquery.Client(credentials=credentials, project=project_id)

        # check if table already exists
        table = None
        try:
            table = client.get_table(table_name)
        except NotFound:
            pass


        def writeback_new_table():
            step = "insert"
            job = client.load_table_from_dataframe(df, table_name)
            result = job.result()
            inserted_rows = result.output_rows
            updated_rows = 0
            ignored_rows = 0

            result = {
                "_tag": "success",
                "dataSourceId": "placeholder",
                "tableName": table_name,
                "overwritten": overwrite_table,
                "insertedRows": inserted_rows,
                "updatedRows": 0,
                "ignoredRows": 0,
                "executedAt": executed_at
            }
            print(json.dumps(result))

        def writeback_overwrite_table():
            # delete all rows
            step = "cleanup"
            query = f"DELETE FROM {table_name} WHERE 1=1"
            job = client.query(query)
            job.result()

            step = "insert"
            job = client.load_table_from_dataframe(df, table_name)
            result = job.result()
            inserted_rows = result.output_rows
            updated_rows = 0
            ignored_rows = 0

            result = {
                "_tag": "success",
                "dataSourceId": "placeholder",
                "tableName": table_name,
                "overwritten": overwrite_table,
                "insertedRows": inserted_rows,
                "updatedRows": updated_rows,
                "ignoredRows": ignored_rows,
                "executedAt": executed_at
            }
            print(json.dumps(result))

        def create_temp_table():
            step = "insert"
            temp_table_name = f"{table_name}_{int(datetime.datetime.now().timestamp())}"
            job = client.load_table_from_dataframe(df, temp_table_name)
            job.result()
            return temp_table_name

        def merge_no_conflict_columns(temp_table_name):
            query = f"""
                INSERT INTO {table_name} ({", ".join(df_columns)})
                SELECT {", ".join(df_columns)} FROM {temp_table_name}
            """

            job = client.query(query)
            result = job.result()

            inserted_rows = result.output_rows
            updated_rows = 0
            ignored_rows = 0

            # clean up the temp table
            query = f"DROP TABLE {temp_table_name}"
            job = client.query(query)
            job.result()

            result = {
                "_tag": "success",
                "dataSourceId": "placeholder",
                "tableName": table_name,
                "overwritten": overwrite_table,
                "insertedRows": inserted_rows,
                "updatedRows": updated_rows,
                "ignoredRows": ignored_rows,
                "executedAt": executed_at
            }
            print(json.dumps(result))

        def merge_with_conflict_columns(temp_table_name):
            conflict_combination = " AND ".join([f"target.{col} = source.{col}" for col in on_conflict_columns])

            insert_count_query = f"""
                SELECT COUNT(*) FROM (
                    SELECT source.{on_conflict_columns[0]} as s, target.{on_conflict_columns[0]} as t
                    FROM {temp_table_name} source
                    LEFT JOIN {table_name} target
                    ON {conflict_combination}
                )
                WHERE t IS NULL
            """
            inserted_rows = list(client.query(insert_count_query).result())[0][0]

            if on_conflict == "update":
                updated_rows_query = f"""
                    SELECT COUNT(*) FROM {temp_table_name} source
                    INNER JOIN {table_name} target
                    ON {conflict_combination}
                """
                updated_rows = list(client.query(updated_rows_query).result())[0][0]

                merge_query = f"""
                    MERGE INTO {table_name} target
                    USING {temp_table_name} source
                    ON {conflict_combination}
                    WHEN MATCHED THEN
                        UPDATE SET {", ".join([f"target.{col} = source.{col}" for col in df_columns])}
                    WHEN NOT MATCHED THEN
                        INSERT ({", ".join(df_columns)})
                        VALUES ({", ".join([f"source.{col}" for col in df_columns])})
                """
            elif on_conflict == "ignore":
                updated_rows = 0

                merge_query = f"""
                    MERGE INTO {table_name} target
                    USING {temp_table_name} source
                    ON {conflict_combination}
                    WHEN NOT MATCHED THEN
                        INSERT ({", ".join(df_columns)})
                        VALUES ({", ".join([f"source.{col}" for col in df_columns])})
                """
            else:
                raise ValueError(f"Invalid onConflict value: {on_conflict}")

            client.query(merge_query).result()

            ignored_rows = df.shape[0] - inserted_rows - updated_rows

            result = {
                "_tag": "success",
                "dataSourceId": "placeholder",
                "tableName": table_name,
                "overwritten": overwrite_table,
                "insertedRows": inserted_rows,
                "updatedRows": updated_rows,
                "ignoredRows": ignored_rows,
                "executedAt": executed_at
            }
            print(json.dumps(result))

        if not table:
            writeback_new_table()
            return

        if overwrite_table:
            # cannot overwrite table with empty dataframe
            if len(df) == 0:
              result = {
                  "_tag": "error",
                  "reason": "overwrite-empty-dataframe",
                  "executedAt": executed_at
              }
              print(json.dumps(result))
              return

            writeback_overwrite_table()
            return

        # if the dataframe is empty, we know that there are no rows to upsert
        if len(df) == 0:
            result = {
                "_tag": "success",
                "dataSourceId": "placeholder",
                "tableName": table_name,
                "overwritten": overwrite_table,
                "insertedRows": 0,
                "updatedRows": 0,
                "ignoredRows": 0,
                "executedAt": executed_at
            }
            print(json.dumps(result, default=str))
        else:
            temp_table_name = create_temp_table()
            try:
                if len(on_conflict_columns) == 0:
                    merge_no_conflict_columns(temp_table_name)
                else:
                    merge_with_conflict_columns(temp_table_name)
            finally:
                # clean up the temp table
                query = f"DROP TABLE {temp_table_name}"
                job = client.query(query)
                job.result()
    except (BadRequest, PermissionDenied) as e:
        result = {
            "_tag": "error",
            "step": step,
            "reason": "python-error",
            "ename": type(e).__name__,
            "evalue": str(e),
            "executedAt": executed_at
        }
        print(json.dumps(result))


if "${dataframeName}" in globals():
    _briefer_writeback(
        ${dataframeName},
        "${tableName}",
        ${overwriteTable ? 'True' : 'False'},
        "${onConflict}",
        ${JSON.stringify(onConflictColumns)}
    )
else:
    from datetime import datetime
    import json
    result = {
        "_tag": "error",
        "step": "validation",
        "reason": "dataframe-not-found",
        "executedAt": datetime.now().isoformat()
    }
    print(json.dumps(result))`

  return code
}
