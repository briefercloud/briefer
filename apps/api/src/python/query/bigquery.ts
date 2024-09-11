import { v4 as uuidv4 } from 'uuid'
import { BigQueryDataSource, getCredentials } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import { makeQuery } from './index.js'
import { renderJinja } from '../index.js'

export async function makeBigQueryQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: BigQueryDataSource,
  encryptionKey: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const credentials = await getCredentials(datasource, encryptionKey)

  const flag = uuidv4()
  const flagFilePath = `/home/jupyteruser/.briefer/query-${flag}.flag`

  const renderedQuery = await renderJinja(workspaceId, sessionId, sql)
  if (typeof renderedQuery !== 'string') {
    return [
      Promise.resolve({
        ...renderedQuery,
        type: 'python-error',
      }),
      async () => {},
    ]
  }

  const query = renderedQuery

  const code = `
def _briefer_make_bq_query():
    from google.cloud import bigquery
    from google.cloud import bigquery_storage
    from google.oauth2 import service_account
    from google.api_core.exceptions import BadRequest
    import pandas as pd
    import os
    import json
    import time
    import concurrent.futures
    from concurrent.futures import ThreadPoolExecutor
    import threading
    import queue

    def get_columns(df):
        columns = []
        for col, dtype in df.dtypes.items():
            if pd.api.types.is_string_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
                try:
                    categories = list(df[col].dropna().unique())

                    # use dict.fromkeys instead of set to keep the order
                    categories = list(dict.fromkeys(categories))

                    categories = categories[:1000]
                    columns.append({"name": col, "type": dtype.name, "categories": categories})
                except Exception as e:
                    print(json.dumps({"type": "log", "message": f"Error getting categories for column {col}: {e}"}))
                    columns.append({"name": col, "type": dtype.name})
            else:
                columns.append({"name": col, "type": dtype.name})

        return columns



    print(json.dumps({"type": "log", "message": "Starting BQ query"}))

    def get_query_schema(sql, client):
        job_config = bigquery.QueryJobConfig(dry_run=True, use_query_cache=False)
        query_job = client.query(sql, job_config=job_config)

        return query_job.schema

    convertible_types = ['DATE', 'DATETIME', 'TIME', 'TIMESTAMP', 'NUMERIC']
    def convert_columns(df, columns_by_type):
        for col, bq_type in columns_by_type.items():
            if col in df.columns:
                if bq_type in ['DATE', 'DATETIME']:
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                elif bq_type == 'TIMESTAMP':
                    # Convert to timezone-aware datetime, preserving the original time zone
                    df[col] = pd.to_datetime(df[col], errors='coerce', utc=True).dt.tz_convert(None)
                elif bq_type == 'TIME':
                    df[col] = pd.to_datetime(df[col], errors='coerce').dt.time
                elif bq_type == 'NUMERIC':
                    df[col] = pd.to_numeric(df[col], errors='coerce')
                elif bq_type == "REPEATED":
                    print(json.dumps({"type": "log", "message": f"Converting column {col} to list"}))
                    df[col] = df[col].apply(lambda x: json.loads(json.dumps(x if x is not None else [], default=str)))

    # all types: https://cloud.google.com/bigquery/docs/reference/rest/v2/tables#TableFieldSchema.FIELDS.type
    def object_encoding_from_schema(schema):
        object_encoding = {}
        for field in schema:
            if field.mode == 'REPEATED':
                object_encoding[field.name] = 'json'
            elif field.field_type == 'STRING':
                object_encoding[field.name] = 'utf8'
            elif field.field_type == 'BYTES':
                object_encoding[field.name] = 'bytes'
            elif field.field_type == 'INTEGER':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'INT64':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'FLOAT':
                object_encoding[field.name] = 'float'
            elif field.field_type == 'FLOAT64':
                object_encoding[field.name] = 'float'
            elif field.field_type == 'NUMERIC':
                object_encoding[field.name] = 'decimal'
            elif field.field_type == 'BOOLEAN':
                object_encoding[field.name] = 'bool'
            elif field.field_type == 'BOOL':
                object_encoding[field.name] = 'bool'
            elif field.field_type == 'TIMESTAMP':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'DATE':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'TIME':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'DATETIME':
                object_encoding[field.name] = 'int'
            elif field.field_type == 'GEOGRAPHY':
                object_encoding[field.name] = 'json'
            elif field.field_type == 'NUMERIC':
                object_encoding[field.name] = 'decimal'
            elif field.field_type == 'BIGNUMERIC':
                object_encoding[field.name] = 'decimal'
            elif field.field_type == 'JSON':
                object_encoding[field.name] = 'json'
            elif field.field_type == 'RECORD':
                object_encoding[field.name] = 'json'
            elif field.field_type == 'STRUCT':
                object_encoding[field.name] = 'json'
            elif field.field_type == 'RANGE':
                object_encoding[field.name] = 'json'
            else:
                object_encoding[field.name] = 'json'
        return object_encoding

    aborted = False
    dump_file_base = f'/home/jupyteruser/.briefer/query-${queryId}'
    parquet_file_path = f'{dump_file_base}.parquet.gzip'
    csv_file_path = f'{dump_file_base}.csv'

    object_encoding = None
    queue = queue.Queue()
    def dump_worker():
        dumped_count = 0
        is_first = True
        is_over = False

        if os.path.exists(parquet_file_path):
            os.remove(parquet_file_path)

        if os.path.exists(csv_file_path):
            os.remove(csv_file_path)

        while not (is_over or aborted):
            first_chunk = queue.get()
            if first_chunk is None:
                break
            chunks = [first_chunk]
            while queue.qsize() > 0:
                chunk = queue.get()
                if chunk is None:
                    is_over = True
                else:
                    chunks.append(chunk)

            chunk = pd.concat(chunks, ignore_index=True)
            convert_columns(chunk, columns_by_type)

            mode = 'a'
            if is_first:
                mode = 'w'
                os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)

            try:
                # write to parquet
                print(json.dumps({"type": "log", "message": f"Dumping {len(chunk)} rows as parquet, queue size {queue.qsize()}"}))
                chunk.to_parquet(parquet_file_path, compression='gzip', index=False, append=not is_first, engine="fastparquet", object_encoding=object_encoding)

                # write to csv
                print(json.dumps({"type": "log", "message": f"Dumping {len(chunk)} rows as csv, queue size {queue.qsize()}"}))
                chunk.to_csv(csv_file_path, index=False, mode=mode, header=is_first)

                is_first = False
                dumped_count += len(chunk)
                print(json.dumps({"type": "log", "message": f"Dumped {len(chunk)} rows, total {dumped_count} rows, queue size {queue.qsize()}"}))
            except Exception as e:
                print(json.dumps({"type": "log", "message": f"Error dumping chunk: {e}"}))
                raise

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

    # Load credentials and create a BigQuery client
    print(json.dumps({"type": "log", "message": "Loading credentials"}))
    credentials_info = json.loads(${JSON.stringify(
      JSON.stringify(credentials)
    )})
    credentials = service_account.Credentials.from_service_account_info(credentials_info)
    print(json.dumps({"type": "log", "message": "Creating client"}))
    client = bigquery.Client(credentials=credentials, project=credentials_info['project_id'])

    flag_file_path = ${JSON.stringify(flagFilePath)}
    os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)
    print(json.dumps({"type": "log", "message": "Creating flag file"}))
    open(flag_file_path, "a").close()

    dump_thread = threading.Thread(target=dump_worker)
    dump_thread.start()

    try:
        print(json.dumps({"type": "log", "message": "Running query"}))

        query_job = client.query(${JSON.stringify(query)})
        query_result = query_job.result()

        print(json.dumps({"type": "log", "message": "Fetching resulting schema"}))
        schema = get_query_schema(${JSON.stringify(query)}, client)
        object_encoding = object_encoding_from_schema(schema)

        columns_by_type = {}
        for field in schema:
            if field.mode == 'REPEATED':
                columns_by_type[field.name] = "REPEATED"
            elif field.field_type in convertible_types:
                columns_by_type[field.name] = field.field_type

        print(json.dumps({"type": "log", "message": f"rows count {query_result.total_rows}"}))
        if query_result.total_rows == 0:
            result = {
                "type": "success",
                "rows": [],
                "columns": [],
                "count": 0
            }
            df = query_result.to_dataframe()
            convert_columns(df, columns_by_type)
            df.to_parquet(parquet_file_path, compression='gzip', index=False, engine="fastparquet")
            df.to_csv(csv_file_path, index=False)
            print(json.dumps(result, default=str))
            return df

        bq_storage_client = bigquery_storage.BigQueryReadClient(credentials=credentials)
        df_iter = query_result.to_dataframe_iterable(bqstorage_client=bq_storage_client)
        df = pd.DataFrame()

        initial_rows = []
        columns = None
        last_emitted_at = 0
        chunks = []
        rows_count = 0
        for chunk in df_iter:
            if not os.path.exists(flag_file_path):
                print(json.dumps({"type": "log", "message": "Query aborted"}))
                aborted = True
                break

            chunk = rename_duplicates(chunk)
            rows_count += len(chunk)
            queue.put(chunk)
            chunks.append(chunk)

            if len(initial_rows) < 250:
                df = pd.concat(chunks, ignore_index=True)
                convert_columns(df, columns_by_type)
                initial_rows = json.loads(df.head(250).to_json(orient='records', date_format="iso"))
                if columns is None:
                    columns = get_columns(df)

            now = time.time()
            if now - last_emitted_at > 1:
                result = {
                    "type": "success",
                    "rows": initial_rows,
                    "columns": columns,
                    "count": rows_count
                }
                print(json.dumps({"type": "log", "message": f"Emitting {rows_count} rows"}))
                print(json.dumps(result, default=str))
                last_emitted_at = now

        print(json.dumps({"type": "log", "message": "Waiting for dump worker to finish"}))
        queue.put(None)
        dump_thread.join()

        if aborted or not os.path.exists(flag_file_path):
            print(json.dumps({"type": "log", "message": "Query aborted"}))
            result = {
                "type": "abort-error",
                "message": "Query aborted",
            }
            print(json.dumps(result, default=str))
            return None

        if len(initial_rows) < 250:
            initial_rows = json.loads(df.head(250).to_json(orient='records', date_format="iso"))

        columns = get_columns(df)
        result = {
            "type": "success",
            "rows": initial_rows,
            "columns": columns,
            "count": rows_count
        }
        print(json.dumps(result, default=str))
    except BadRequest as e:
        error = {
            "type": "syntax-error",
            "message": str(e)
        }
        print(json.dumps(error, default=str))
    finally:
      if os.path.exists(flag_file_path):
          os.remove(flag_file_path)

_briefer_make_bq_query()
del _briefer_make_bq_query`

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
