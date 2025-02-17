import { v4 as uuidv4 } from 'uuid'
import { AthenaDataSource } from '@briefer/database/types/datasources/athena'
import {
  RunQueryResult,
  SQLQueryConfiguration,
  SuccessRunQueryResult,
} from '@briefer/types'
import { getDatabaseURL } from '@briefer/database'
import { makeQuery } from './index.js'
import { renderJinja } from '../index.js'

export async function makeAthenaQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  datasource: AthenaDataSource,
  encryptionKey: string,
  sql: string,
  resultOptions: { pageSize: number; dashboardPageSize: number },
  onProgress: (result: SuccessRunQueryResult) => void,
  configuration: SQLQueryConfiguration | null
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
  const databaseURL = await getDatabaseURL(
    { type: 'athena', data: datasource },
    encryptionKey
  )

  const url = new URL(databaseURL)
  const s3StagingDir = url.searchParams.get('s3_staging_dir')
  const accessKeyId = url.searchParams.get('aws_access_key_id')
  const secretAccessKey = url.searchParams.get('aws_secret_access_key')

  if (!s3StagingDir || !accessKeyId || !secretAccessKey) {
    const missing = Object.entries({
      s3_staging_dir: s3StagingDir,
      aws_access_key_id: accessKeyId,
      aws_secret_access_key: secretAccessKey,
    }).reduce<string[]>((acc, [key, value]) => {
      if (!value) {
        acc.push(key)
      }
      return acc
    }, [])

    throw new Error(
      `Athena datasource is missing required parameters: ${missing.join(', ')}`
    )
  }

  const jobId = uuidv4()
  const flagFilePath = `/home/jupyteruser/.briefer/query-${jobId}.flag`

  // Render the SQL query if needed (handle placeholders, filters, etc.)
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

  let resultReuseByAgeConfigurationMaxAgeInMinutes = configuration?.athena
    ?.resultReuseConfiguration.resultReuseByAgeConfiguration.enabled
    ? configuration?.athena?.resultReuseConfiguration
        .resultReuseByAgeConfiguration.maxAgeInMinutes
    : null
  if (resultReuseByAgeConfigurationMaxAgeInMinutes !== null) {
    resultReuseByAgeConfigurationMaxAgeInMinutes = Math.min(
      1440,
      Math.max(1, resultReuseByAgeConfigurationMaxAgeInMinutes)
    )
  }

  const code = `
def briefer_make_athena_query():
    import boto3
    import botocore
    import pandas as pd
    import time
    import json
    import os
    import tempfile
    from datetime import datetime
    from datetime import date
    from urllib.parse import urlparse

    page_size = ${resultOptions.pageSize}
    dashboard_page_size = ${resultOptions.dashboardPageSize}
    actual_page_size = max(page_size, dashboard_page_size)

    def get_columns_result(columns):
        json_columns = []

        for col in columns:
            categories = []
            if col["np_type"] == "object":
                try:
                    categories = df[col["name"]].dropna().unique()

                    # use dict.fromkeys instead of set to keep the order
                    categories = list(dict.fromkeys(categories))

                    categories = categories[:1000]
                    json_columns.append({"name": col["name"], "type": col["np_type"], "categories": categories})
                except Exception as e:
                    print(json.dumps({"type": "log", "message": f"Error getting categories for column {col}: {e}"}))
                    json_columns.append({"name": col["name"], "type": col["np_type"]})
            else:
                json_columns.append({"name": col["name"], "type": col["np_type"]})

        return json_columns


    def convert_type(t):
        if t == "boolean":
            return "boolean"
        if t == "tinyint":
            return "Int8"
        if t == "smallint":
            return "Int16"
        if t == "integer":
            return "Int32"
        if t == "bigint":
            return "Int64"
        if t == "float":
            return "float32"
        if t == "double" or t == "decimal":
            return "float64"
        if t == "varchar":
            return "object"
        if t == "varbinary":
            return "object"
        if t == "date":
            return "object"
        if t == "timestamp":
            return "datetime64[ns]"
        if t == "array" or t == "map" or t == "row":
            return "object"

        print(json.dumps({"type": "log", "message": f"Unknown t: {t}"}))
        return "object"

    def convert_value(value, name, t):
        if t == "boolean":
            return value == "true"
        if t == "tinyint" or t == "smallint" or t == "integer" or t == "bigint":
            return int(value)
        if t == "float" or t == "double" or t == "decimal":
            return float(value)
        if t == "varchar":
            return value
        if t == "varbinary":
            return bytes.fromhex(value.replace(" ", ""))
        if t == "date":
            return datetime.strptime(value, "%Y-%m-%d").date()
        if t == "timestamp":
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S.%f")
        if t == "array" or t == "map" or t == "row":
            return value

        print(json.dumps({"type": "log", "message": f"Unknown t: {t} for for column {name}"}))
        return value


    def to_pandas(athena_data):
        columns = []
        col_counts = {}  # Dictionary to track the count of column names
        for col in athena_data["ResultSet"]["ResultSetMetadata"]["ColumnInfo"]:
            col_name = col["Label"]
            if col_name in col_counts:
                col_counts[col_name] += 1
                col_name = f"{col_name}.{col_counts[col_name]}"
            else:
                col_counts[col_name] = 0

            columns.append({"name": col_name, "type": col["Type"], "np_type": convert_type(col["Type"])})

        rows = athena_data["ResultSet"]["Rows"]
        data = []
        for row in rows[1:]:
            cells = []
            for cell, col in zip(row["Data"], columns):
                str_value = cell.get("VarCharValue", None)
                if str_value is not None:
                    cells.append(convert_value(str_value, col["name"], col["type"]))
                else:
                    cells.append(None)
            data.append(cells)

        df = pd.DataFrame(data, columns=[col["name"] for col in columns])
        for col in columns:
            t = convert_type(col["type"])
            df[col["name"]] = df[col["name"]].astype(t)

        return df, columns

    try:
        s3_staging_dir = "${s3StagingDir}"
        dump_file_base = f'/home/jupyteruser/.briefer/query-${queryId}'
        parquet_file_path = f'{dump_file_base}.parquet.gzip'
        csv_file_path = f'{dump_file_base}.csv'
        flag_file_path = ${JSON.stringify(flagFilePath)}
        os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)
        print(json.dumps({"type": "log", "message": "Creating flag file"}))
        open(flag_file_path, "a").close()

        athena_client = boto3.client(
            "athena",
            aws_access_key_id="${accessKeyId}",
            aws_secret_access_key="${secretAccessKey}",
            region_name="${datasource.region}",
        )

        result_reuse_configuration = {"ResultReuseByAgeConfiguration": {"Enabled": False}}
        result_reuse_by_age_configuration_max_age_in_minutes = ${
          resultReuseByAgeConfigurationMaxAgeInMinutes
            ? resultReuseByAgeConfigurationMaxAgeInMinutes
            : 'None'
        }
        if result_reuse_by_age_configuration_max_age_in_minutes:
            result_reuse_configuration["ResultReuseByAgeConfiguration"] = {
              "Enabled": True,
              "MaxAgeInMinutes": result_reuse_by_age_configuration_max_age_in_minutes,
            }

        query_response = athena_client.start_query_execution(
            QueryString=${JSON.stringify(renderedQuery)},
            QueryExecutionContext={"Database": "default"},
            ResultConfiguration={
                "OutputLocation": s3_staging_dir,
            },
            ResultReuseConfiguration=result_reuse_configuration,
        )

        query_id = query_response["QueryExecutionId"]
        while True:
            if not os.path.exists(flag_file_path):
                result = {
                    "type": "abort-error",
                    "message": "Query aborted",
                }
                print(json.dumps(result, ensure_ascii=False, default=str))
                return

            query_status = athena_client.get_query_execution(QueryExecutionId=query_id)
            state = query_status["QueryExecution"]["Status"]["State"]
            if state == "CANCELLED":
                result = {
                    "type": "abort-error",
                    "message": "Query aborted",
                }
                print(json.dumps(result, ensure_ascii=False, default=str))
                return

            if state == "FAILED":
                result = {
                    "type": "syntax-error",
                    "message": query_status["QueryExecution"]["Status"]["StateChangeReason"],
                }
                print(json.dumps(result, ensure_ascii=False, default=str))
                return

            if state == "SUCCEEDED":
                break

            time.sleep(1)

        if not os.path.exists(flag_file_path):
            result = {
                "type": "abort-error",
                "message": "Query aborted",
            }
            print(json.dumps(result, ensure_ascii=False, default=str))
            return

        try:
            statistics = athena_client.get_query_runtime_statistics(QueryExecutionId=query_id)
            total_rows = statistics.get("QueryRuntimeStatistics", {}).get("Rows", {}).get("OutputRows", None)
        except Exception as e:
            print(json.dumps({"type": "log", "message": f"Error getting total rows: {e}"}))
            total_rows = None
            pass

        data = athena_client.get_query_results(QueryExecutionId=query_id)
        if not os.path.exists(flag_file_path):
            result = {
                "type": "abort-error",
                "message": "Query aborted",
            }
            print(json.dumps(result, ensure_ascii=False, default=str))
            return

        df, columns = to_pandas(data)

        rows = json.loads(df.head(actual_page_size).to_json(orient='records', date_format="iso"))

        result = {
            "version": 3,

            "type": "success",
            "rows": rows[:page_size],
            "count": len(df),
            "columns": get_columns_result(columns),

            "page": 0,
            "pageSize": page_size,
            "pageCount": int(len(df) // page_size + 1),

            "dashboardPage": 0,
            "dashboardPageSize": dashboard_page_size,
            "dashboardPageCount": int(len(df) // dashboard_page_size + 1),
        }
        print(json.dumps(result, ensure_ascii=False, default=str))

        s3 = boto3.client(
            "s3",
            aws_access_key_id="${accessKeyId}",
            aws_secret_access_key="${secretAccessKey}",
            region_name="${datasource.region}",
        )

        with tempfile.TemporaryDirectory() as tmpdir:
            s3_url = urlparse(s3_staging_dir)
            s3_bucket = s3_url.netloc
            s3_dir = s3_url.path[1:]

            output_location = query_status.get("QueryExecution", {}).get("ResultConfiguration", {}).get("OutputLocation", None)
            if output_location:
                # remove s3://bucket_name/ prefix
                output_location = urlparse(output_location).path[1:]
            else:
                output_location= f"{s3_dir}{query_id}.csv"
            print(json.dumps({"type": "log", "message": f"Downloading s3://{s3_bucket}/{output_location}"}))

            output_file_size = s3.head_object(Bucket=s3_bucket, Key=output_location)["ContentLength"]

            last_emitted_at = 0
            total_bytes_transferred = 0
            def callback(bytes_transferred):
                nonlocal last_emitted_at, total_bytes_transferred

                if not total_rows:
                    return

                total_bytes_transferred += bytes_transferred
                estimated_rows = int(total_rows * total_bytes_transferred / output_file_size)
                result["count"] = estimated_rows
                now = time.time()
                if now - last_emitted_at > 1:
                    last_emitted_at = now
                    print(json.dumps(result, ensure_ascii=False, default=str))
              
            s3.download_file(
              Bucket=s3_bucket,
              Key=output_location,
              Filename=f"{tmpdir}/{query_id}.csv",
              Callback=callback
            )
            if not os.path.exists(flag_file_path):
                result = {
                    "type": "abort-error",
                    "message": "Query aborted",
                }
                print(json.dumps(result, ensure_ascii=False, default=str))
                return

            # Extract column types from the original dataframe and identify datetime columns
            dtype_dict = {}
            parse_dates_list = []
            for col in columns:
                col_name = col["name"]
                col_type = col["type"]
                if col_type == "timestamp" or col_type == "date":
                    parse_dates_list.append(col_name)
                else:
                    dtype_dict[col_name] = convert_type(col_type)

            df = pd.read_csv(f"{tmpdir}/{query_id}.csv", dtype=dtype_dict, parse_dates=parse_dates_list)
            if not os.path.exists(flag_file_path):
                result = {
                    "type": "abort-error",
                    "message": "Query aborted",
                }
                print(json.dumps(result, ensure_ascii=False, default=str))
                return

            rows = json.loads(df.head(actual_page_size).to_json(orient='records', date_format="iso"))
            result = {
                "version": 3,

                "type": "success",
                "columns": get_columns_result(columns),
                "rows": rows[:page_size],
                "count": len(df),

                "page": 0,
                "pageSize": page_size,
                "pageCount": int(len(df) // page_size + 1),

                "dashboardPage": 0,
                "dashboardPageSize": dashboard_page_size,
                "dashboardPageCount": int(len(df) // dashboard_page_size + 1),
                "dashboardRows": rows[:dashboard_page_size],

                "queryDurationMs": query_status.get("QueryExecution", {}).get("Statistics", {}).get("TotalExecutionTimeInMillis", None),
            }
            print(json.dumps(result, ensure_ascii=False, default=str))

            os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)
            df.to_parquet(parquet_file_path, compression='gzip', index=False)
            df.to_csv(csv_file_path, index=False)
    except botocore.exceptions.ClientError as e:
        result = {
            "type": "syntax-error",
            "message": str(e),
        }
        print(json.dumps(result, ensure_ascii=False, default=str))
    finally:
        if os.path.exists(flag_file_path):
            os.remove(flag_file_path)

briefer_make_athena_query()`

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

// {
//     "Version": "2012-10-17",
//     "Statement": [
//         {
//             "Effect": "Allow",
//             "Action": [
//                 "glue:BatchCreatePartition",
//                 "athena:GetTableMetadata",
//                 "athena:StartQueryExecution",
//                 "athena:ListDataCatalogs",
//                 "glue:DeleteDatabase",
//                 "lakeformation:GetDataAccess",
//                 "glue:GetPartitions",
//                 "glue:BatchDeletePartition",
//                 "glue:UpdateTable",
//                 "athena:GetQueryResults",
//                 "glue:DeleteTable",
//                 "athena:GetDatabase",
//                 "athena:GetDataCatalog",
//                 "athena:ListWorkGroups",
//                 "athena:ListQueryExecutions",
//                 "athena:GetWorkGroup",
//                 "athena:GetExecutionEngine",
//                 "athena:StopQueryExecution",
//                 "athena:GetExecutionEngines",
//                 "glue:CreatePartition",
//                 "athena:RunQuery",
//                 "glue:UpdatePartition",
//                 "athena:ListEngineVersions",
//                 "glue:UpdateDatabase",
//                 "athena:GetQueryResultsStream",
//                 "glue:CreateTable",
//                 "glue:GetTables",
//                 "athena:GetNamespace",
//                 "athena:GetQueryExecutions",
//                 "glue:BatchGetPartition",
//                 "glue:GetDatabases",
//                 "athena:GetCatalogs",
//                 "glue:GetTable",
//                 "glue:GetDatabase",
//                 "athena:GetNamespaces",
//                 "glue:GetPartition",
//                 "athena:ListDatabases",
//                 "glue:CreateDatabase",
//                 "athena:CancelQueryExecution",
//                 "athena:GetQueryExecution",
//                 "athena:GetTables",
//                 "glue:BatchDeleteTable",
//                 "athena:GetTable",
//                 "athena:ListTableMetadata",
//                 "glue:DeletePartition",
//                 "athena:BatchGetQueryExecution"
//             ],
//             "Resource": "*"
//         },
//         {
//             "Effect": "Allow",
//             "Action": [
//                 "s3:PutObject",
//                 "s3:GetObject",
//                 "s3:ListBucketMultipartUploads",
//                 "s3:PutBucketPublicAccessBlock",
//                 "s3:AbortMultipartUpload",
//                 "s3:CreateBucket",
//                 "s3:ListBucket",
//                 "s3:GetBucketLocation",
//                 "s3:ListMultipartUploadParts"
//             ],
//             "Resource": [
//                 "arn:aws:s3:::your-athena-bucket",
//                 "arn:aws:s3:::your-athena-bucket/*"
//             ]
//         }
//     ]
// }
