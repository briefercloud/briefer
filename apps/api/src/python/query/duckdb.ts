import { RunQueryResult, SuccessRunQueryResult } from '@briefer/types'
import { makeQuery } from './index.js'
import { renderJinja } from '../index.js'

export async function makeDuckDBQuery(
  workspaceId: string,
  sessionId: string,
  queryId: string,
  dataframeName: string,
  sql: string,
  onProgress: (result: SuccessRunQueryResult) => void
): Promise<[Promise<RunQueryResult>, () => Promise<void>]> {
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

  const flagFilePath = `/home/jupyteruser/.briefer/query-${queryId}.flag`

  const code = `
def _briefer_make_duckdb_query():
    import duckdb
    import json
    import pandas as pd
    import os
    
    dump_file_base = f'/home/jupyteruser/.briefer/query-${queryId}'
    parquet_file_path = f'{dump_file_base}.parquet.gzip'
    csv_file_path = f'{dump_file_base}.csv'
    os.makedirs('/home/jupyteruser/.briefer', exist_ok=True)

    try:
        # install and load spacial
        duckdb.install_extension("spatial")
        duckdb.load_extension("spatial")
        query = duckdb.query(${JSON.stringify(renderedQuery)})
        if query == None:
            result = {
                "version": 2,

                "type": "success",
                "columns": [],
                "rows": [],
                "count": 0,

                "page": 0,
                "pageSize": 50,
                "pageCount": 1,
            }
            print(json.dumps(result, ensure_ascii=False, default=str))
            return

        df = query.df()
        rows = json.loads(df.head(50).to_json(orient='records', date_format='iso'))

        # convert all values to string to make sure we preserve the python values
        # when displaying this data in the browser
        for row in rows:
            for key in row:
                row[key] = str(row[key])

        columns = [{"name": col, "type": dtype.name} for col, dtype in df.dtypes.items()]
        for col in columns:
            dtype = df[col["name"]].dtype
            if pd.api.types.is_string_dtype(dtype) or pd.api.types.is_categorical_dtype(dtype):
                try:
                    categories = df[col["name"]].dropna().unique()
                    categories = list(categories)

                    # use dict.fromkeys instead of set to keep the order
                    categories = list(dict.fromkeys(categories))

                    categories = categories[:1000]
                    col["categories"] = categories
                except:
                    pass
        result = {
            "version": 2,

            "type": "success",
            "columns": columns,
            "rows": rows,
            "count": len(df)

            "page": 0,
            "pageSize": 50,
            "pageCount": int(len(df) // 50 + 1),
        }
        print(json.dumps(result, ensure_ascii=False, default=str))
        df.to_parquet(parquet_file_path, compression='gzip', index=False)
        df.to_csv(csv_file_path, index=False)

    except duckdb.ProgrammingError as e:
        error = {
            "type": "syntax-error",
            "message": str(e)
        }
        print(json.dumps(error, ensure_ascii=False, default=str))

_briefer_make_duckdb_query()`

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
