import {
  Output,
  DataFrame,
  exhaustiveCheck,
  PythonErrorOutput,
  jsonString,
  VisualizationFilter,
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
import numpy as np
import math
from jinja2 import Template

def _briefer_render_filter_value(filter):
    try:
        if isinstance(filter["value"], list):
            value = list(map(lambda x: Template(x).render(**globals()), filter["value"]))
        else:
            value = Template(filter["value"]).render(**globals())

        return value
    except Exception as e:
        filter["renderError"] = {
          "type": "error",
          "ename": e.__class__.__name__,
          "evalue": str(e),
          "traceback": []
        }
        return None

def _briefer_create_visualization(df, options):
    def extract_chart_type(chart_type):
        """
        Transforms the chart type from Briefer input to one that is supported by ECharts
        It also returns whether the chart is an area chart and if it should be stacked.

        Parameters:
        chart_type (str): The chart type from Briefer input

        Returns:
        tuple: The transformed chart type, whether it is an area chart, whether it should be stacked and wheather it should be normalized
        """

        if chart_type == "groupedColumn":
            return "bar", False, False, False
        elif chart_type == "stackedColumn":
            return "bar", False, True, False
        elif chart_type == "hundredPercentStackedColumn":
            return "bar", False, True, True
        elif chart_type == "line":
            return "line", False, False, False
        elif chart_type == "area":
            return "line", True, True, False
        elif chart_type == "hundredPercentStackedArea":
            return "line", True, True, True
        elif chart_type == "scatterPlot":
            return "scatter", False, False, False
        elif chart_type == "pie":
            raise ValueError("Pie chart is not implemented yet")
        elif chart_type == "histogram":
            raise ValueError("Histogram chart is not supported")
        elif chart_type == "trend":
            return "bar", False, False, False
        elif chart_type == "number":
            return "bar", False, False, False

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
        if options["xAxis"]:
            return df.sort_values(
                by=options["xAxis"]["name"],
                ascending=options["xAxisSort"] == "ascending"
            )
        elif options["xAxisSort"] == "descending":
            # just reverse the order
            return df.iloc[::-1].reset_index(drop=True)

        return df

    def get_series_df(df, options, y_axis, series):
        # Prepare data by grouping
        result = group_dataframe(df.copy(), options, y_axis, series)
        if "_grouped" in result:
            result[options["xAxis"]["name"]] = result["_grouped"]
            result = result.drop(columns=["_grouped"])

        result = sort_dataframe(result, options)

        capped = False
        if len(result) > 50000:
            if options["chartType"] == "number" or options["chartType"] == "trend":
                # number chart type are never considered capped we just pick the tail
                # they don't ever care about more than 2 points anyways
                result = result.tail(50000)
            else:
                capped = True
                result = result.head(50000)

        return result, capped

    def apply_filters(df, filters):
        for filter in filters:
            column_name = filter['column']['name']
            operator = filter['operator']

            value = _briefer_render_filter_value(filter)

            # if the value is None, rendering failed, skip this filter
            if value == None:
                continue

            if filter["value"] != value:
                filter["renderedValue"] = value

            if pd.api.types.is_numeric_dtype(df[column_name]):
                value = pd.to_numeric(value, errors='coerce')
                if operator == 'eq':
                    df = df[df[column_name] == value]
                elif operator == 'ne':
                    df = df[df[column_name] != value]
                elif operator == 'lt':
                    df = df[df[column_name] < value]
                elif operator == 'lte':
                    df = df[df[column_name] <= value]
                elif operator == 'gt':
                    df = df[df[column_name] > value]
                elif operator == 'gte':
                    df = df[df[column_name] >= value]
                elif operator == 'isNull':
                    df = df[df[column_name].isnull()]
                elif operator == 'isNotNull':
                    df = df[df[column_name].notnull()]
            elif pd.api.types.is_string_dtype(df[column_name]) or pd.api.types.is_categorical_dtype(df[column_name]) or pd.api.types.is_object_dtype(df[column_name]):
                if operator == 'eq':
                    df = df[df[column_name] == value]
                elif operator == 'ne':
                    df = df[df[column_name] != value]
                elif operator == 'contains':
                    df = df[df[column_name].str.contains(value)]
                elif operator == 'notContains':
                    df = df[~df[column_name].str.contains(value)]
                elif operator == 'startsWith':
                    df = df[df[column_name].str.startswith(value)]
                elif operator == 'endsWith':
                    df = df[df[column_name].str.endswith(value)]
                elif operator == 'in':
                    df = df[df[column_name].isin(value)]
                elif operator == 'notIn':
                    df = df[~df[column_name].isin(value)]
                elif operator == 'isNull':
                    df = df[df[column_name].isnull()]
                elif operator == 'isNotNull':
                    df = df[df[column_name].notnull()]
            elif pd.api.types.is_datetime64_any_dtype(df[column_name]):
                # Convert both DataFrame column and value to UTC safely
                df_column_utc, value_utc = _briefer_convert_to_utc_safe(df[column_name], pd.to_datetime(value))

                # Perform comparisons using the safely converted UTC values
                if operator == 'eq':
                    df = df[df_column_utc == value_utc]
                elif operator == 'ne':
                    df = df[df_column_utc != value_utc]
                elif operator == 'before':
                    df = df[df_column_utc < value_utc]
                elif operator == 'beforeOrEq':
                    df = df[df_column_utc <= value_utc]
                elif operator == 'after':
                    df = df[df_column_utc > value_utc]
                elif operator == 'afterOrEq':
                    df = df[df_column_utc >= value_utc]
                elif operator == 'isNull':
                    df = df[df[column_name].isnull()]
                elif operator == 'isNotNull':
                    df = df[df[column_name].notnull()]
        return df

    data = {
        "tooltip": {
            "trigger": "axis",
        },
        "legend": {},
        "dataset": [],
        "xAxis": [{
            "type": "category",
            "axisPointer": {
                "type": "shadow",
            },
            "name": options["xAxisName"],
            "nameLocation": "middle",
            "nameGap": 30
        }],
        "yAxis": [],
        "series": [],
    }

    too_many_data_points = False

    df = apply_filters(df, options["filters"])

    if options["chartType"] == "histogram":
        column = df[options["xAxis"]["name"]]
        hist_range = (min(column.min(), 0), column.max())
        bins = "auto"
        if options["histogramBin"]["type"] == "auto":
            bins = "auto"
        elif options["histogramBin"]["type"] == "stepSize":
            bins_count = math.ceil((hist_range[1] - hist_range[0]) / options["histogramBin"]["value"])
            bins = [i*options["histogramBin"]["value"] for i in range(bins_count + 1)]
        elif options["histogramBin"]["type"] == "maxBins":
            _, bins = np.histogram(column, bins="auto", range=hist_range)
            if len(bins) > options["histogramBin"]["value"]:
                bins = options["histogramBin"]["value"]

        hist, bins = np.histogram(column, bins=bins, range=hist_range)

        if options["histogramFormat"] == "percentage":
            total = hist.sum()
            hist = list(map(lambda x: x / total if total != 0 else 0, hist))
        else:
            hist = list(map(lambda x: int(x), hist))
            
        data["dataset"] = [{
            "dimensions": ["bin", "value"],
            "source": []
        }]
        data["yAxis"].append({
          "type": "value",
          "position": "left",
          "name": None,
          "nameLocation": "middle",
          "nameGap": 30
        })
        series = {
            "type": "bar",
            "datasetIndex": 0,
            "yAxisIndex": 0,
            "z": 0,
            "barWidth": "99.5%"
        }
        if options["showDataLabels"]:
            series["label"] = {"show": True, "position": "top"}
        data["series"].append(series)
        for bin, val in zip(bins, hist):
            data["dataset"][0]["source"].append({
                "bin": bin,
                "value": val
            })
    else:
        for y_index, y_axis in enumerate(options["yAxes"]):
            data["yAxis"].append({
                "type": "value",
                "position": "left" if y_index % 2 == 0 else "right",
                "name": None,
                "nameLocation": "middle",
                "nameGap": 30
            })

            totals = {}

            for i, series in enumerate(y_axis["series"]):
                series_dataframe, capped = get_series_df(df, options, y_axis, series)
                if capped:
                    too_many_data_points = True

                chart_type, is_area, is_stack, should_normalize = extract_chart_type(series["chartType"] or options["chartType"])
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

                        row_data = {}

                        if options["xAxis"]:
                            x_name = options["xAxis"]["name"]
                            x_value = convert_value(series_dataframe[x_name], row[x_name])
                            row_data[x_name] = x_value

                        if should_normalize:
                            total = totals.get(x_value)
                            if not total:
                                total = series_dataframe[series_dataframe[x_name] == x_value][y_name].sum()
                                totals[x_value] = total
                            y_value = y_value / total if total != 0 else 1

                        row_data[y_name] = y_value

                        dataset["source"].append(row_data)

                    data["dataset"].append(dataset)

                    serie = {
                      "type": chart_type,
                      "datasetIndex": dataset_index,
                      "yAxisIndex": y_index,
                      "z": i,
                    }

                    if group:
                        serie["name"] = group

                    if is_area:
                        serie["areaStyle"] = {}

                    if is_stack:
                        serie["stack"] = f"stack_{i}"

                    if options["showDataLabels"]:
                        serie["label"] = {"show": True, "position": "top"}
                        if is_stack:
                            serie["label"]["position"] = "inside"

                    data["series"].append(serie)

    output = json.dumps({
        "type": "result",
        "data": {
            "success": True,
            "data": data,
            "tooManyDataPoints": too_many_data_points,
            "filters": options["filters"]
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
    tooManyDataPoints: z.boolean(),
    filters: z.array(VisualizationFilter),
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
    let filters = input.filters
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
