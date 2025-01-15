import {
  Output,
  DataFrame,
  exhaustiveCheck,
  PythonErrorOutput,
  jsonString,
} from '@briefer/types'
import { executeCode, PythonExecutionError } from './index.js'
import { IJupyterManager } from '../jupyter/index.js'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'
import AggregateError from 'aggregate-error'
import { z } from 'zod'
import { logger } from '../logger.js'

function getCode(dataframe: DataFrame, input: VisualizationV2BlockInput) {
  const strInput = JSON.stringify(input)
  let code = `import json
import pandas as pd
from datetime import datetime

def _briefer_create_visualization(df, options):
    def extract_chart_type(chartType):
        if chartType == "groupedColumn":
            return "bar", False, False
        elif chartType == "stackedColumn":
            return "bar", False, True
        elif chartType == "hundredPercentStackedColumn":
            return "bar", False, True,
        elif chartType == "line":
            return "line", False, False
        elif chartType == "area":
            return "line", True, True
        elif chartType == "hundredPercentStackedArea":
            return "line", True, True
        elif chartType == "scatterPlot":
            return "scatter", False, False
        elif chartType == "pie":
            raise ValueError("Pie chart is not implemented yet")
        elif chartType == "histogram":
            raise ValueError("Histogram chart is not supported")
        elif chartType == "trend":
            return "bar", False, False
        elif chartType == "number":
            return "bar", False, False

    def convert_value(column, value):
        if pd.api.types.is_numeric_dtype(column):
            return pd.to_numeric(value, errors="coerce")

        if pd.api.types.is_datetime64_any_dtype(column):
            return value.isoformat()

        return value

    def group_dataframe(df, options, y_axis, series):
        if not options["xAxis"]:
            return df

        freqs = {
            "year": "Y",
            "quarter": "Q",
            "month": "M",
            "week": "W",
            "date": "D",
            "hours": "h",
            "minutes": "min",
            "seconds": "s"
        }

        y_group_by = series["groupBy"]["name"] if series["groupBy"] else None
        grouping_columns = ["_grouped"] + ([y_group_by] if y_group_by else [])

        if pd.api.types.is_datetime64_any_dtype(df[options["xAxis"]["name"]]):
            if options["xAxisGroupFunction"] and series["aggregateFunction"]:
                freq = freqs.get(options["xAxisGroupFunction"], "s")

                y_axis_agg_func = series["aggregateFunction"]
                datetime_agg_funcs = set(["count", "mean", "median"])
                if pd.api.types.is_datetime64_any_dtype(df[series["column"]["name"]]):
                    if y_axis_agg_func not in datetime_agg_funcs:
                        y_axis_agg_func = "count"

                # Group by the specified frequency and aggregate the values
                df["_grouped"] = df[options["xAxis"]["name"]].dt.to_period(freq).dt.start_time
                df = df.groupby(grouping_columns).agg({
                  series["column"]["name"]: y_axis_agg_func
                }).reset_index()
            elif options["xAxisGroupFunction"]:
                freq = freqs.get(options["xAxisGroupFunction"], "s")

                df[options["xAxis"]["name"]] = pd.to_datetime(df[options["xAxis"]["name"]])

                # Group by the specified frequency
                df[options["xAxis"]["name"]] = df[options["xAxis"]["name"]].dt.to_period(freq).dt.start_time
        elif series["aggregateFunction"]:
                y_axis_agg_func = series["aggregateFunction"]
                datetime_agg_funcs = set(["count", "mean", "median"])
                if pd.api.types.is_datetime64_any_dtype(df[series["column"]["name"]]):
                    if y_axis_agg_func not in datetime_agg_funcs:
                        y_axis_agg_func = "count"

                df["_grouped"] = df[options["xAxis"]["name"]]
                df = df.groupby(grouping_columns).agg({
                  series["column"]["name"]: y_axis_agg_func
                }).reset_index()


        return df

    def sort_dataframe(df, options):
        if options["xAxis"] and options["xAxisSort"]:
            return df.sort_values(
                by=options["xAxis"]["name"],
                ascending=options["xAxisSort"] == "ascending"
            )

        return df

    def get_series_df(df, options, y_axis, series):
        # Prepare data by grouping
        result = group_dataframe(df.copy(), options, y_axis, series)
        if "_grouped" in result:
            result[options["xAxis"]["name"]] = result["_grouped"]
            result = result.drop(columns=["_grouped"])

        result = sort_dataframe(result, options)

        return result


    data = {
        "tooltip": {
            "trigger": "axis",
        },
        "dataset": [],
        "xAxis": [{
            "type": "category",
            "axisPointer": {
                "type": "shadow",
            },
        }],
        "yAxis": [],
        "series": [],
    }

    for y_axis in options["yAxes"]:
        data["yAxis"].append({ "type": "value" })

        for i, series in enumerate(y_axis["series"]):
            series_dataframe = get_series_df(df, options, y_axis, series)

            chart_type, is_area, is_stack = extract_chart_type(series["chartType"] or options["chartType"])
            if series["groupBy"]:
                groups = series_dataframe[series["groupBy"]["name"]].unique()
                groups.sort()
            else:
                groups = [None]

            for group in groups:
                dataset_index = len(data["dataset"])

                dimensions = [series["column"]["name"]]
                if options["xAxis"]:
                    dimensions.insert(0, options["xAxis"]["name"])

                dataset = {
                    "dimensions": dimensions,
                    "source": [],
                }

                for _, row in series_dataframe.iterrows():
                    if group and row[series["groupBy"]["name"]] != group:
                        continue

                    y_name = series["column"]["name"]
                    y_value = convert_value(series_dataframe[y_name], row[y_name])

                    row_data = {y_name: y_value}

                    if options["xAxis"]:
                        x_name = options["xAxis"]["name"]
                        x_value = convert_value(series_dataframe[x_name], row[x_name])
                        row_data[x_name] = x_value

                    dataset["source"].append(row_data)

                data["dataset"].append(dataset)

                serie = {
                  "type": chart_type,
                  "datasetIndex": dataset_index,
                  "z": i,
                }

                if group:
                    serie["name"] = group

                if is_area:
                    serie["areaStyle"] = {}

                if is_stack:
                    serie["stack"] = f"stack_{i}"

                data["series"].append(serie)

    output = json.dumps({
        "type": "result",
        "data": {
            "success": True,
            "data": data
        }
    }, default=str)

    print(output)


if "${dataframe.name}" in globals():
    df = ${dataframe.name}.copy()
    options = json.loads(${JSON.stringify(strInput)})
    _briefer_create_visualization(df, options)
else:
    output = json.dumps({
        "type":"result",
        "data": {
            "success": False,
            "reason": "dataframe-not-found"
        }
    }, default=str)
    print(output)`

  return code
}

const CreateVisualizationResult = z.union([
  z.object({
    success: z.literal(true),
    data: VisualizationV2BlockOutputResult,
  }),
  z.object({
    success: z.literal(false),
    reason: z.union([
      z.literal('dataframe-not-found'),
      z.literal('aborted'),
      z.literal('invalid-params'),
    ]),
  }),
])
type CreateVisualizationResult = z.infer<typeof CreateVisualizationResult>

export type CreateVisualizationTask = {
  promise: Promise<CreateVisualizationResult>
  abort: () => Promise<void>
}

export async function createVisualizationV2(
  workspaceId: string,
  sessionId: string,
  dataframe: DataFrame,
  input: VisualizationV2BlockInput,
  jupyterManager: IJupyterManager,
  executePython: typeof executeCode
): Promise<CreateVisualizationTask> {
  await jupyterManager.ensureRunning(workspaceId)

  const code = getCode(dataframe, input)

  let outputs: Output[] = []
  const { promise: execute, abort } = await executePython(
    workspaceId,
    sessionId,
    code,
    (newOutputs) => {
      outputs = outputs.concat(newOutputs)
    },
    { storeHistory: false }
  )

  const promise = execute.then((): CreateVisualizationResult => {
    let result: CreateVisualizationResult | null = null
    const pythonErrors: PythonErrorOutput[] = []
    const outputParsingErrors: Error[] = []
    for (const output of outputs) {
      switch (output.type) {
        case 'html':
          break
        case 'error':
          pythonErrors.push(output)
          break
        case 'stdio':
          switch (output.name) {
            case 'stdout':
              for (const l of output.text.split('\n')) {
                const line = l.trim()
                if (line === '') {
                  continue
                }

                if (!result?.success) {
                  const parsed = jsonString
                    .pipe(
                      z.union([
                        z.object({
                          type: z.literal('log'),
                          message: z.string(),
                        }),
                        z.object({
                          type: z.literal('result'),
                          data: CreateVisualizationResult,
                        }),
                      ])
                    )
                    .safeParse(line.trim())
                  if (parsed.success) {
                    switch (parsed.data.type) {
                      case 'log':
                        logger().info(
                          {
                            workspaceId,
                            sessionId,
                            message: parsed.data.message,
                            input,
                          },
                          'createVisualizationV2 log'
                        )
                        break
                      case 'result':
                        result = parsed.data.data
                        break
                      default:
                        exhaustiveCheck(parsed.data)
                    }
                  } else {
                    outputParsingErrors.push(parsed.error)
                  }
                }
              }
              break
            case 'stderr':
              console.error(output.text)
              break
            default:
              exhaustiveCheck(output.name)
          }
          break
        case 'image':
          break
        case 'plotly':
          break
        default:
          exhaustiveCheck(output)
      }
    }

    if (
      (pythonErrors.length > 0 || outputParsingErrors.length > 0) &&
      result === null
    ) {
      throw new AggregateError([
        ...pythonErrors.map(
          (err) =>
            new PythonExecutionError(
              err.type,
              err.ename,
              err.evalue,
              err.traceback
            )
        ),
        ...outputParsingErrors,
      ])
    }

    if (result === null) {
      throw new Error('Got no output back from running createVisualizationV2')
    }

    return result
  })

  return {
    promise,
    abort,
  }
}
