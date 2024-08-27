import {
  PivotTableColumn,
  PivotTableMetric,
  PivotTableRow,
} from '@briefer/editor'
import {
  AggregateFunction,
  DataFrame,
  Output,
  PivotTableResult,
  PivotTableSort,
  jsonString,
} from '@briefer/types'
import {
  PythonExecutionError,
  PythonStderrError,
  executeCode,
} from './index.js'
import { z } from 'zod'
import AggregateError from 'aggregate-error'
import { logger } from '../logger.js'

function getCode(
  dataframe: DataFrame,
  rows: PivotTableRow[],
  columns: PivotTableColumn[],
  metrics: PivotTableMetric[],
  sort: PivotTableSort | null,
  varName: string,
  page: number,
  operation: 'create' | 'read'
): string {
  const rowNames = rows
    .map((r) => r.column?.name?.toString())
    .filter((c): c is string => c !== undefined)
  const colNames = columns
    .map((c) => c.column?.name?.toString())
    .filter((c): c is string => c !== undefined)

  const metricNames = metrics.reduce(
    (acc: { name: string; aggregateFunction: AggregateFunction }[], m) => {
      if (m.column) {
        return acc.concat([
          {
            name: m.column.name.toString(),
            aggregateFunction: m.aggregateFunction ?? 'count',
          },
        ])
      }

      return acc
    },
    []
  )
  const pageSize = 50

  const code = `
import json

def _briefer_print_pivot_table_page(pivot_table, rows, columns, metrics, sort, page=1, page_size=50):
    import numpy as np

    page_count = (len(pivot_table) // page_size) + 1
    if page > page_count:
        page = page_count
    elif page < 1:
        page = 1

    pivot_table = pivot_table.replace([np.nan], 0)

    if sort:
        try:
            if sort["_tag"] == "row":
                pivot_table = pivot_table.sort_index(level=sort["row"], ascending=sort["order"] == "asc")
            elif sort["_tag"] == "column":
                if len(sort["columnValues"]) == 1:
                    by = sort["columnValues"][0]
                else:
                    by = ()
                    for cv in sort["columnValues"]:
                        by += (cv,)

                pivot_table = pivot_table.reindex(
                    pivot_table[sort["metric"]].sort_values(
                        by=by,
                        ascending=sort["order"] == "asc"
                    ).index
                )

        except Exception as e:
            print(json.dumps({"log": "Failed to sort pivot table", "error": str(e)}, default=str))
            pass


    table = pivot_table.iloc[page_size * (page - 1): page_size * page]

    result = {
      "page": page,
      "pageSize": page_size,
      "pageCount": page_count,
      "data": table.to_dict(orient="split"),
      "pivotRows": rows,
      "pivotColumns": columns,
      "pivotMetrics": [m["name"] for m in metrics],
    }

    print(json.dumps({"success": True, "result": result}, default=str, allow_nan=False))


def _briefer_create_pivot_table(df, rows, columns, metrics, sort, page=1, page_size=50):
    aggfunc = {}
    for m in metrics:
        aggfunc[m["name"]] = m["aggregateFunction"]

    pivot_table = df.pivot_table(
        index=rows,
        columns=columns,
        values=[m["name"] for m in metrics],
        aggfunc=aggfunc
    )

    _briefer_print_pivot_table_page(pivot_table, rows, columns, metrics, sort, page, page_size)

    return pivot_table


def _briefer_pivot_table_run():
    if "${dataframe.name}" in globals():
        df = globals()["${dataframe.name}"]
        rows = json.loads(${JSON.stringify(JSON.stringify(rowNames))})
        columns = json.loads(${JSON.stringify(JSON.stringify(colNames))})
        metrics = json.loads(${JSON.stringify(JSON.stringify(metricNames))})
        sort = json.loads(${JSON.stringify(JSON.stringify(sort))})
        page = ${page}
        page_size = ${pageSize}
        operation = "${operation}"

        if operation == "read":
            if "${varName}" in globals():
                _briefer_print_pivot_table_page(
                    globals()["${varName}"],
                    rows=rows,
                    columns=columns,
                    metrics=metrics,
                    sort=sort,
                    page=page,
                    page_size=page_size
                )
            else:
                globals()["${varName}"] = _briefer_create_pivot_table(
                    df,
                    rows=rows,
                    columns=columns,
                    metrics=metrics,
                    sort=sort,
                    page=page,
                    page_size=page_size
                )

        else:
            globals()["${varName}"] = _briefer_create_pivot_table(
                ${dataframe.name},
                rows=rows,
                columns=columns,
                metrics=metrics,
                sort=sort,
                page=1,
                page_size=page_size
            )
    else:
        print(json.dumps({"success": False, "reason": "dataframe-not-found"}))

_briefer_pivot_table_run()`

  return code
}

const CreatePivotTableOutput = z.union([
  z.object({
    success: z.literal(true),
    result: PivotTableResult,
  }),
  z.object({
    success: z.literal(false),
    reason: z.union([z.literal('aborted'), z.literal('dataframe-not-found')]),
  }),
])

type CreatePivotTableOutput = z.infer<typeof CreatePivotTableOutput>

type CreatePivotTableResult = {
  promise: Promise<CreatePivotTableOutput>
  abort: () => Promise<void>
}

export async function createPivotTable(
  workspaceId: string,
  sessionId: string,
  dataframe: DataFrame,
  rows: PivotTableRow[],
  columns: PivotTableColumn[],
  metrics: PivotTableMetric[],
  sort: PivotTableSort | null,
  varName: string,
  page: number,
  operation: 'create' | 'read'
): Promise<CreatePivotTableResult> {
  const code = getCode(
    dataframe,
    rows,
    columns,
    metrics,
    sort,
    varName,
    page,
    operation
  )

  let outputs: Output[] = []
  const { abort, promise } = await executeCode(
    workspaceId,
    sessionId,
    code,
    (otps) => {
      outputs = outputs.concat(otps)
    },
    {
      storeHistory: true,
    }
  )

  let errors: Error[] = []
  const p = promise.then((): CreatePivotTableOutput => {
    for (const output of outputs) {
      if (output.type === 'error') {
        if (output.ename === 'KeyboardInterrupt') {
          return {
            success: false,
            reason: 'aborted',
          }
        }

        throw new PythonExecutionError(
          output.type,
          output.ename,
          output.evalue,
          output.traceback,
          `Got error while creating pivot table "${varName}" from dataframe "${dataframe.name}"`
        )
      }

      if (output.type === 'stdio') {
        if (output.name === 'stderr') {
          errors.push(
            new PythonStderrError(
              workspaceId,
              sessionId,
              output.text,
              `Got stderr while creating pivot table "${varName}" from dataframe "${dataframe.name}"`
            )
          )
          continue
        }

        for (const line of output.text.split('\n')) {
          const result = jsonString
            .pipe(
              z.union([
                CreatePivotTableOutput,
                z.object({
                  log: z.string(),
                  error: z.string(),
                }),
              ])
            )
            .safeParse(line)

          if (result.success) {
            if ('log' in result.data) {
              logger.error(
                {
                  workspaceId,
                  sessionId,
                  error: result.data.error,
                  log: result.data.log,
                },
                'Got log while creating pivot table'
              )
              continue
            }

            return result.data
          }

          errors.push(result.error)
        }
      }
    }

    if (errors.length > 0) {
      throw new AggregateError(errors)
    }

    throw new Error(
      `Got no output while creating pivot table "${varName}" from dataframe "${dataframe.name}"`
    )
  })

  return {
    promise: p,
    abort,
  }
}
