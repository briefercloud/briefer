import {
  Output,
  DataFrame,
  exhaustiveCheck,
  PythonErrorOutput,
  jsonString,
  VisualizationFilter,
  isUnfinishedVisualizationFilter,
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
  const filters = input.filters.filter((f) => {
    if (isUnfinishedVisualizationFilter(f)) {
      return false
    }

    return true
  })

  const strInput = JSON.stringify({ ...input, filters })

  let code = `import json
import pandas as pd
from datetime import datetime
import numpy as np
import math
from jinja2 import Template

class _BrieferNpEncoder(json.JSONEncoder):
    def default(self, obj):
        if pd.api.types.is_integer_dtype(obj):
            return int(obj)
        if pd.api.types.is_float_dtype(obj):
            return float(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        try:
            return super(_BrieferNpEncoder, self).default(obj)
        except:
            return str(obj)

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

def _briefer_convert_to_utc_safe(datetime_series, comparison_value):
    # Localize timezone-naive datetimes to UTC
    if datetime_series.dt.tz is None:
        localized_series = datetime_series.dt.tz_localize('UTC')
    else:
        localized_series = datetime_series.dt.tz_convert('UTC')

    # Localize comparison_value to UTC if it's naive
    if comparison_value.tzinfo is None or comparison_value.tzinfo.utcoffset(comparison_value) is None:
        comparison_value_utc = comparison_value.tz_localize('UTC')
    else:
        comparison_value_utc = comparison_value.tz_convert('UTC')

    return localized_series, comparison_value_utc

def _briefer_create_visualization(df, options):
    colors = [
        "#5470c6",
        "#91cc75",
        "#fac858",
        "#ee6666",
        "#73c0de",
        "#3ba272",
        "#fc8452",
        "#9a60b4",
        "#ea7ccc"
    ]

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

    def group_dataframe(df, options, y_axis, series):
        if not options["xAxis"]:
            # When no x-axis is specified, we still need to ensure the series ID column exists
            df[series["id"]] = df[series["column"]["name"]]
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
        aggregate_func = series["aggregateFunction"] or "count"

        df[series["id"]] = df[series["column"]["name"]]

        if pd.api.types.is_datetime64_any_dtype(df[options["xAxis"]["name"]]):
            if options["xAxisGroupFunction"]:
                freq = freqs.get(options["xAxisGroupFunction"], "s")

                # Group by the specified frequency and aggregate the values
                df["_grouped"] = df[options["xAxis"]["name"]].dt.to_period(freq).dt.start_time
                df = df.groupby(grouping_columns, as_index=False).agg({
                  series["id"]: aggregate_func
                }).reset_index()
            else:
                # just group by values who are the same
                df["_grouped"] = df[options["xAxis"]["name"]]
                df = df.groupby(grouping_columns, as_index=False).agg({
                  series["id"]: aggregate_func
                }).reset_index()
        else:
            df["_grouped"] = df[options["xAxis"]["name"]]
            df = df.groupby(grouping_columns, as_index=False).agg({
              series["id"]: aggregate_func
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

        if series["groupBy"]:
            groups = result[series["groupBy"]["name"]].unique()
            if len(groups) > 100:
                capped = True
                groups = groups[:100]
                result = result[result[series["groupBy"]["name"]].isin(groups)]

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
            elif pd.api.types.is_string_dtype(df[column_name]) or isinstance(df[column_name].dtype, pd.CategoricalDtype) or pd.api.types.is_object_dtype(df[column_name]):
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

    def get_axis_type(df, column, options):
        if not column or options["chartType"] == "histogram":
            return "category"

        if pd.api.types.is_numeric_dtype(df[column["name"]]):
            return "value"
        elif pd.api.types.is_datetime64_any_dtype(df[column["name"]]):
            return "time"

        return "category"

    df = apply_filters(df, options["filters"])

    x_axis = {
        "type": get_axis_type(df, options["xAxis"], options),
        "axisPointer": {
            "type": "shadow",
        },
        "name": options["xAxisName"],
        "nameLocation": "middle",
    }
    if x_axis["type"] == "time" or x_axis["type"] == "value":
        x_axis["min"] = "dataMin"
        x_axis["max"] = "dataMax"

    data = {
        "tooltip": {"trigger": "axis"},
        "grid": {"containLabel": True},
        "legend": {},
        "dataset": [],
        "xAxis": [x_axis],
        "yAxis": [],
        "series": [],
    }

    too_many_data_points = False

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
          "name": options["yAxes"][0]["name"] if len(options["yAxes"]) > 0 else None,
          "nameLocation": "middle",
        })

        id = "y-0-series-0"
        series = {
            "id": id,
            "type": "bar",
            "datasetIndex": 0,
            "yAxisIndex": 0,
            "z": 0,
            "barWidth": "99.5%",
        }
        color = colors[0]
        series["color"] = color

        if options["dataLabels"]["show"]:
            series["label"] = {"show": True, "position": "top"}
            series["labelLayout"] = {"hideOverlap": options["dataLabels"]["frequency"] == "some"}
        data["series"].append(series)
        for bin, val in zip(bins, hist):
            data["dataset"][0]["source"].append({
                "bin": bin,
                "value": val
            })
    else:
        color_index = -1
        for y_index, y_axis in enumerate(options["yAxes"]):
            data_y_axis = {
                "type": "value",
                "position": "left" if y_index % 2 == 0 else "right",
                "name": y_axis["name"],
                "nameLocation": "middle",
            }
            data["yAxis"].append(data_y_axis)

            totals = {}

            for i, series in enumerate(y_axis["series"]):
                if not series.get("column"):
                    continue

                series_dataframe, capped = get_series_df(df, options, y_axis, series)
                if capped:
                    too_many_data_points = True

                chart_type, is_area, is_stack, should_normalize = extract_chart_type(series["chartType"] or options["chartType"])
                if series["groupBy"]:
                    groups = series_dataframe[series["groupBy"]["name"]].unique()
                    groups = np.sort(groups)
                else:
                    groups = [None]

                group_order = [g["group"] for g in series.get("groups")] if series.get("groups") else None
                if group_order:
                    groups = sorted(groups, key=lambda item: group_order.index(item) if item in group_order else float('inf'))

                group_options = {}
                for g_option in series.get("groups") or []:
                    group_options[g_option["group"]] = g_option

                y_name = series["id"]

                # Group rows by their group value first to avoid iterating through all rows for each group
                grouped_rows = {}
                if series["groupBy"]:
                    for _, row in series_dataframe.iterrows():
                        group_value = row[series["groupBy"]["name"]]
                        if group_value not in grouped_rows:
                            grouped_rows[group_value] = []
                        grouped_rows[group_value].append(row)
                else:
                    # Store just the rows without the index for consistency
                    grouped_rows[None] = [row for _, row in series_dataframe.iterrows()]

                for group in groups:
                    color_index += 1
                    dataset_index = len(data["dataset"])
                    g_options = group_options.get(group) if group is not None else {}

                    dimensions = [y_name]
                    if options["xAxis"]:
                        dimensions.insert(0, options["xAxis"]["name"])

                    dataset = {
                        "dimensions": dimensions,
                        "source": [],
                    }

                    # Process only rows for this specific group
                    group_rows = grouped_rows.get(group, [])
                    for row in group_rows:  # No need to unpack since we're just storing rows
                        y_value = row[y_name]
                        row_data = {}

                        if options["xAxis"]:
                            x_name = options["xAxis"]["name"]
                            x_value = row[x_name]
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

                    id = f"{series['id']}"
                    if group is not None:
                        id = f"{id}:{group}"

                    serie = {
                      "id": id,
                      "type": chart_type,
                      "datasetIndex": dataset_index,
                      "yAxisIndex": y_index,
                      "z": i,
                    }

                    # Only add encode property with x axis if xAxis is defined
                    if options["xAxis"]:
                        serie["encode"] = {
                          "x": options["xAxis"]["name"],
                          "y": y_name,
                        }
                    else:
                        serie["encode"] = {
                          "x": "__default_x",
                          "y": y_name,
                        }

                    if chart_type == "line":
                        serie["symbolSize"] = 6

                    if group is None:
                        color = series.get("color") or colors[color_index % len(colors)]
                    elif g_options:
                        color = g_options.get("color") or colors[color_index % len(colors)]
                    else:
                        color = colors[color_index % len(colors)]

                    if group is None:
                        serie["name"] = series.get("name") or series["column"]["name"]
                    elif group and g_options:
                        serie["name"] = g_options.get("name") or group
                    elif group is not None:
                        serie["name"] = group
                    else:
                        serie["name"] = series["column"]["name"]

                    if is_area:
                        serie["areaStyle"] = {}
                        serie["areaStyle"]["color"] = color

                    if chart_type == "bar":
                        serie["color"] = color
                    elif chart_type == "line":
                        serie["lineStyle"] = {"color": color, "width": 2}
                        serie["itemStyle"] = {"color": color}
                    elif chart_type == "scatter":
                        serie["itemStyle"] = {"color": color}

                    if is_stack:
                        serie["stack"] = f"stack-{y_index}-{i}"

                    if options["dataLabels"]["show"]:
                        serie["label"] = {"show": True, "position": "top"}
                        if is_stack:
                            serie["label"]["position"] = "inside"

                        serie["labelLayout"] = {"hideOverlap": options["dataLabels"]["frequency"] == "some"}

                    data["series"].append(serie)

                if chart_type != "scatter" and options["xAxis"] and series["groupBy"]:
                    # fill missing x values with 0
                    all_x_values = set()
                    for dataset in data["dataset"]:
                        for row in dataset["source"]:
                            all_x_values.add(row[options["xAxis"]["name"]])
                    for dataset in data["dataset"]:
                        all_x_values_in_dataset = set([row[options["xAxis"]["name"]] for row in dataset["source"]])
                        missing_x_values = all_x_values - all_x_values_in_dataset
                        for x_value in missing_x_values:
                            dataset["source"].append({options["xAxis"]["name"]: x_value, y_name: 0})
                        if options["xAxisSort"] == "ascending":
                            dataset["source"] = sorted(dataset["source"], key=lambda x: x[options["xAxis"]["name"]])
                        else:
                            dataset["source"] = sorted(dataset["source"], key=lambda x: x[options["xAxis"]["name"]], reverse=True)



    output = json.dumps({
        "type": "result",
        "data": {
            "success": True,
            "data": data,
            "tooManyDataPoints": too_many_data_points,
            "filters": options["filters"]
        }
    }, cls=_BrieferNpEncoder)

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
    const pythonErrors: PythonErrorOutput[] = []
    const outputParsingErrors: Error[] = []
    for (const output of outputs) {
      switch (output.type) {
        case 'html':
          break
        case 'error':
          if (output.ename === 'KeyboardInterrupt') {
            result = { success: false, reason: 'aborted' }
            break
          }

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
              logger().error(
                {
                  workspaceId,
                  sessionId,
                  message: output.text,
                },
                'Got stderr while running createVisualizationV2'
              )
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
