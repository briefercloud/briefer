import { DataSource, getDatabaseURL } from '@briefer/database'
import { Writeback } from './index.js'
import { executeCode, renderJinja } from '../index.js'
import { WriteBackResult, jsonString } from '@briefer/types'
import { logger } from '../../logger.js'

export async function writebackPSQL(
  workspaceId: string,
  sessionId: string,
  dataframeName: string,
  datasource: DataSource,
  tableName: string,
  overwriteTable: boolean,
  onConflict: 'update' | 'ignore',
  encryptionKey: string
): Promise<Writeback> {
  const executedAt = new Date().toISOString()

  const databaseUrl = await getDatabaseURL(datasource, encryptionKey)

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
    databaseUrl
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

            logger().error(
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
                        ? { ...parsed.data, dataSourceId: datasource.data.id }
                        : parsed.data
                  } else {
                    result = {
                      _tag: 'error',
                      executedAt,
                      step: 'unknown',
                    }

                    logger().error(
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
        logger().error(
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
  databaseUrl: string
): string {
  const code = `
def _briefer_writeback(df, table_name, overwrite_table, on_conflict):
    import json
    from sqlalchemy import create_engine, inspect, text
    from sqlalchemy.exc import DatabaseError
    import pandas as pd
    import datetime
    import random
    import string

    def clean_table(connection, table_name):
        connection.execute(text(f"DELETE FROM {table_name}"))

    def drop_table_if_exists(connection, table_name):
        connection.execute(text(f"DROP TABLE IF EXISTS {table_name}"))

    def insert_ignore(df, table_name, temp_table_name):
        insert_stmt = text(f"""
            WITH ins AS (
                INSERT INTO {table_name} ({', '.join(df.columns)})
                SELECT {', '.join(df.columns)} FROM {temp_table_name}
                ON CONFLICT DO NOTHING
                RETURNING 1
            )
            SELECT COUNT(*) FROM ins
        """)

        return insert_stmt

    def insert_update(df, table_name, temp_table_name, conflict_columns):
        update_set = ', '.join([f'{col} = EXCLUDED.{col}' for col in df.columns])
        insert_stmt = text(f"""
            WITH ins AS (
                INSERT INTO {table_name} ({', '.join(df.columns)})
                SELECT {', '.join(df.columns)} FROM {temp_table_name}
                ON CONFLICT ({', '.join(conflict_columns)})
                DO UPDATE SET {update_set}
                RETURNING *, (xmax = 0) AS is_insert
            )
            SELECT COUNT(*) FILTER (WHERE is_insert) AS inserted_rows,
                   COUNT(*) FILTER (WHERE NOT is_insert) AS updated_rows
            FROM ins
        """)

        return insert_stmt

    def insert_without_conflict(df, table_name, temp_table_name):
        return text(f"""
            WITH ins AS (
                INSERT INTO {table_name} ({', '.join(df.columns)})
                SELECT {', '.join(df.columns)} FROM {temp_table_name}
                RETURNING 1
            )
            SELECT COUNT(*) FROM ins
        """)

    step = "schema-inspection"
    executed_at = datetime.datetime.now().isoformat()

    try:
        engine = create_engine(${JSON.stringify(databaseUrl)})
        inspector = inspect(engine)

        # if table does not exist, just use to_sql
        if table_name not in inspector.get_table_names():
            step = "insert"
            inserted_rows = df.to_sql(table_name, engine, if_exists='fail', index=False)
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
            return

        step = "cleanup"

        # table exists but we should overwrite it
        if overwrite_table:
            if len(df) == 0:
              result = {
                  "_tag": "error",
                  "reason": "overwrite-empty-dataframe",
                  "executedAt": executed_at
              }
              print(json.dumps(result))
              return

            with engine.connect() as connection:
                tx = connection.begin()
                try:
                    # first we delete all rows from the table
                    clean_table(connection, table_name)
                    step = "insert"

                    # then we use to_sql to put the dataframe in the table
                    # if_exists='append' is used to avoid the table being dropped
                    inserted_rows = df.to_sql(table_name, connection, if_exists='append', index=False)

                    tx.commit()
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
                    return
                except Exception as e:
                    tx.rollback()
                    raise e

        step = "insert"
        # if dataframe is empty do nothing
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
            print(json.dumps(result))
            return

        # table exists and we should append rows
        with engine.connect() as connection:
            tx = connection.begin()
            try:
                random_part = ''.join(random.choices(string.ascii_letters + string.digits, k=10))
                temp_table_name = f"briefer_temp_{table_name}_{random_part}"
                # first we use to_sql to put the dataframe in a new temporary table
                df.to_sql(temp_table_name, connection, if_exists='replace', index=False)

                updated_rows = 0
                inserted_rows = 0

                if on_conflict == "ignore":
                    insert_stmt = insert_ignore(df, table_name, temp_table_name)
                else:
                    # first we get the primary keys and unique constraints
                    primary_keys = [key for key in inspector.get_pk_constraint(table_name)['constrained_columns']]
                    uniques = [unique['column_names'] for unique in inspector.get_unique_constraints(table_name)]
                    conflict_columns = primary_keys + [col for unique in uniques for col in unique]

                    if conflict_columns:
                        insert_stmt = insert_update(df, table_name, temp_table_name, conflict_columns)
                    else:
                        # no primary keys or unique constraints, just insert
                        insert_stmt = insert_without_conflict(df, table_name, temp_table_name)

                insert_result = connection.execute(insert_stmt)
                result_row = insert_result.fetchone()
                inserted_rows = result_row[0]
                updated_rows = result_row[1] if len(result_row) > 1 else 0
                ignored_rows = len(df) - inserted_rows - updated_rows


                # drop the temporary table
                drop_table_if_exists(connection, temp_table_name)

                tx.commit()
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
            except Exception as e:
                tx.rollback()
                raise e
    except DatabaseError as e:
        result = {
            "_tag": "error",
            "executedAt": executed_at,
            "step": step,
            "message": str(e)
        }
        print(json.dumps(result))


if "${dataframeName}" in globals():
    _briefer_writeback(
        ${dataframeName},
        "${tableName}",
        ${overwriteTable ? 'True' : 'False'},
        "${onConflict}"
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
