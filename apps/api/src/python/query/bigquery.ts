import { v4 as uuidv4 } from 'uuid'
import { BigQueryDataSource, getCredentials } from '@briefer/database'
import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import { makeQuery } from './index.js'
import { renderJinja } from '../index.js'
import { getSQLAlchemySchema, pingSQLAlchemy } from './sqlalchemy.js'
import { OnTable } from '../../datasources/structure.js'

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
    from datetime import datetime
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
    import pytz

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
                    # handle out-of-bounds dates
                    fallback_date = datetime(1, 1, 1, 0, 0, 0, 0, tzinfo=pytz.utc)
                    max_date = datetime(9999, 12, 31, 23, 59, 59, 999999, tzinfo=pytz.utc)
                    df[col] = df[col].apply(lambda x: max_date if not pd.isnull(x) and x > max_date else x)
                    df[col] = df[col].apply(lambda x: fallback_date if not pd.isnull(x) and x < fallback_date else x)

                    # make sure timezone is in utc and preserve timezone info
                    df[col] = df[col].apply(lambda x: x.astimezone(pytz.utc) if not pd.isnull(x) and x.tzinfo else x)
                elif bq_type == 'TIME':
                    df[col] = pd.to_datetime(df[col], errors='coerce').dt.time
                elif bq_type == 'NUMERIC':
                    df[col] = pd.to_numeric(df[col], errors='coerce')

    aborted = False
    dump_file_base = f'/home/jupyteruser/.briefer/query-${queryId}'
    parquet_file_path = f'{dump_file_base}.parquet.gzip'
    csv_file_path = f'{dump_file_base}.csv'


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

    try:
        print(json.dumps({"type": "log", "message": "Running query"}))

        query_job = client.query(${JSON.stringify(query)})
        query_result = query_job.result()

        print(json.dumps({"type": "log", "message": "Fetching resulting schema"}))
        schema = get_query_schema(${JSON.stringify(query)}, client)

        columns_by_type = {}
        for field in schema:
            if field.field_type in convertible_types:
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
        arrow_iter = query_result.to_arrow_iterable(bqstorage_client=bq_storage_client)
        df = pd.DataFrame()

        initial_rows = []
        columns = None
        last_emitted_at = 0
        chunks = []
        rows_count = 0
        for chunk in arrow_iter:
            if not os.path.exists(flag_file_path):
                print(json.dumps({"type": "log", "message": "Query aborted"}))
                aborted = True
                break

            # make sure that to_pandas does not crash for dates out of bounds
            chunk_df = chunk.to_pandas(timestamp_as_object=True)

            chunk_df = rename_duplicates(chunk_df)
            rows_count += len(chunk_df)
            chunks.append(chunk_df)

            if len(initial_rows) < 250:
                df = pd.concat(chunks, ignore_index=True)
                convert_columns(df, columns_by_type)
                initial_rows = json.loads(df.head(250).to_json(orient='records', date_format="iso"))

                # convert all values to string to make sure we preserve the python values
                # when displaying this data in the browser
                for row in initial_rows:
                    for key in row:
                        row[key] = str(row[key])

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

            # convert all values to string to make sure we preserve the python values
            # when displaying this data in the browser
            for row in initial_rows:
                for key in row:
                    row[key] = str(row[key])

        columns = get_columns(df)
        result = {
            "type": "success",
            "rows": initial_rows,
            "columns": columns,
            "count": rows_count
        }

        df = pd.concat(chunks, ignore_index=True)
        convert_columns(df, columns_by_type)

        os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)

        try:
            # write to parquet
            print(json.dumps({"type": "log", "message": f"Dumping {len(df)} rows as parquet"}))
            df.to_parquet(parquet_file_path, compression='gzip', index=False)

            # write to csv
            print(json.dumps({"type": "log", "message": f"Dumping {len(df)} rows as csv"}))
            df.to_csv(csv_file_path, index=False, header=True)

            print(json.dumps({"type": "log", "message": f"Dumped {len(df)} rows"}))
        except Exception as e:
            print(json.dumps({"type": "log", "message": f"Error dumping df: {e}"}))
            raise

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

export async function pingBigQuery(
  ds: BigQueryDataSource,
  encryptionKey: string
): Promise<null | Error> {
  const credentialsInfo = await getCredentials(ds, encryptionKey)
  return pingSQLAlchemy(
    { type: 'bigquery', data: ds },
    encryptionKey,
    credentialsInfo
  )
}

export async function getBigQuerySchema(
  ds: BigQueryDataSource,
  encryptionKey: string,
  onTable: OnTable
): Promise<void> {
  const credentialsInfo = await getCredentials(ds, encryptionKey)

  return getSQLAlchemySchema(
    { type: 'bigquery', data: ds },
    encryptionKey,
    credentialsInfo,
    onTable
  )
}
