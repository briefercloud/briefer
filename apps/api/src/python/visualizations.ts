import { format as d3Format } from 'd3-format'
import {
  AggregateFunction,
  ChartType,
  DataFrameColumn,
  NumpyBoolTypes,
  NumpyDateTypes,
  NumpyJsonTypes,
  NumpyNumberTypes,
  NumpyStringTypes,
  Output,
  TimeUnit,
  FinishedVisualizationFilter,
  VisualizationFilter,
  isUnfinishedVisualizationFilter,
  DataFrame,
  JsonObject,
  jsonString,
  HistogramFormat,
  HistogramBin,
  NumpyTimeDeltaTypes,
  YAxis,
  NumpyIntegerTypes,
} from '@briefer/types'
import { executeCode } from './index.js'
import { logger } from '../logger.js'
import { z } from 'zod'
import AggregateError from 'aggregate-error'
import { getJupyterManager } from '../jupyter/index.js'

type Order = 'ascending' | 'descending'

// https://vega.github.io/vega-lite/docs/type.html
// Q - quantitative
// T - temporal
// O - ordinal
// N - nominal
function dfTypeToAltairType(dfType: DataFrameColumn['type']): string {
  if (NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(dfType).success) {
    return 'Q'
  }

  if (NumpyBoolTypes.safeParse(dfType).success) {
    return 'N'
  }

  if (NumpyDateTypes.safeParse(dfType).success) {
    return 'T'
  }

  if (NumpyJsonTypes.safeParse(dfType).success) {
    return 'N'
  }

  if (NumpyStringTypes.safeParse(dfType).success) {
    return 'N'
  }

  throw new Error(`Unknown DataFrameColumn type: ${dfType}`)
}

function getCode(
  dataframe: DataFrame,
  chartType: ChartType,
  xAxis: DataFrameColumn | null,
  xAxisName: string | null,
  xAxisAggregateFunction: AggregateFunction | TimeUnit | null,
  xAxisSort: Order,
  yAxes: YAxis[],
  histogramFormat: HistogramFormat,
  histogramBin: HistogramBin,
  showDataLabels: boolean,
  numberValuesFormat: string | null,
  filtering: FinishedVisualizationFilter[]
) {
  const pythonYAxes = yAxes
    .map((yAxis) => ({
      ...yAxis,
      series: yAxis.series.map((serie) => ({
        ...serie,
        column: serie.column
          ? {
              ...serie.column,
              type: dfTypeToAltairType(serie.column.type ?? 'string'),
            }
          : null,
        colorBy: serie.colorBy
          ? {
              ...serie.colorBy,
              type:
                // integer types are treated as nominal for colorBy
                NumpyIntegerTypes.safeParse(serie.colorBy.type).success
                  ? 'N'
                  : dfTypeToAltairType(serie.colorBy.type),
            }
          : null,
      })),
    }))
    .filter((yAxis) => Boolean(yAxis.series[0]?.column))

  const code = `import json
import altair as alt
import pandas as pd
from jinja2 import Template

axisTitlePadding = 10

def _briefer_get_timezone(series):
    """
    Determine the timezone of a pandas Series if it is datetime-like.
    """
    if pd.api.types.is_datetime64_any_dtype(series):
        if series.dt.tz is not None:
            return str(series.dt.tz)
        return None
    return None

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
        print(json.dumps({ "type": "filter-result", "filter": filter }))
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

def _briefer_create_chart(
    df,
    chart_type,
    x_axis,
    x_axis_name,
    x_axis_type,
    x_axis_group_func,
    x_axis_sort,
    y_axis_name,
    y_axis,
    y_axis_type,
    y_axis_agg_func,
    color_by,
    color_by_type,
    number_values_format,
    show_data_labels,
    color
):
    # Append _x, _y and _color to ensure uniqueness
    x_axis_col = f"{x_axis}_x" if x_axis_group_func is None else f"{x_axis}_{x_axis_group_func}_x"
    y_axis_col = f"{y_axis}_y" if y_axis_agg_func is None else f"{y_axis}_{y_axis_agg_func}_y"
    color_by_name = f"{color_by}_color" if color_by else None

    grouping_columns = [x_axis] if color_by is None else [x_axis, color_by]

    renamed = False
    # Apply groupby and aggregation based on x_axis and y_axis
    if x_axis_type == "T" and x_axis_group_func and y_axis_agg_func:
        # Define the frequency for grouping based on x_axis_group_func
        freq = {
            'year': 'YS',
            'quarter': 'QS',
            'month': 'MS',
            'week': 'W',
            'date': 'D',
            'hours': 'h',
            'minutes': 'min',
            'seconds': 's'
        }.get(x_axis_group_func, 's')

        if y_axis_type == "T":
            # Only allow functions that make sense for time
            y_axis_agg_func = {
                'count': 'count',
                'mean': 'mean',
                'median': 'median'
            }.get(y_axis_agg_func, 'count')
            y_axis_type = "Q"
            y_axis_col = f"{y_axis}_{y_axis_agg_func}_y"
        if len(df) > 0:
          df_grouped = df.groupby([pd.Grouper(key=x_axis, freq=freq)] + ([color_by] if color_by else [])).agg({y_axis: y_axis_agg_func})
        else:
          df_grouped = df
    elif y_axis_agg_func:
        if y_axis_type == "T":
            # Only allow functions that make sense for time
            y_axis_agg_func = {
                'count': 'count',
                'mean': 'mean',
                'median': 'median'
            }.get(y_axis_agg_func, 'count')
            y_axis_type = "Q"
            y_axis_col = f"{y_axis}_{y_axis_agg_func}_y"
        if len(df) > 0:
          df_grouped = df.groupby(grouping_columns).agg({y_axis: y_axis_agg_func})
        else:
          df_grouped = df
    else:
        df_grouped = df
        original_names = {
            "x": x_axis,
            "y": y_axis,
            "color": color_by
        }
        new_names = {
            "x": x_axis_col,
            "y": y_axis_col,
            "color": color_by_name
        }
        # need to make sure all 3 columns names will exist, if they have the same name we need to duplicate
        if x_axis == y_axis:
            df_grouped.loc[:, y_axis_col] = df_grouped[x_axis]
            del original_names["y"]
        if x_axis == color_by:
            df_grouped.loc[:, color_by_name] = df_grouped[x_axis]
            del original_names["color"]
        if y_axis == color_by:
            df_grouped.loc[:, color_by_name] = df_grouped[y_axis]
            if "color" in original_names:
              del original_names["color"]
        rename = {}
        for k, original_name in original_names.items():
            rename[original_name] = new_names[k]
        df.rename(columns=rename, inplace=True)
        if color_by:
            df.rename(columns={color_by: color_by_name}, inplace=True)
        renamed = True

    # Count aggregation is always a Q type
    if y_axis_agg_func == "count":
        y_axis_type = "Q"

    if not renamed:
        # renaming is important to be able to handle x_axis, y_axis and color_by having columns in common
        if isinstance(df_grouped.index, pd.MultiIndex):
            df_grouped.index.names = [x_axis_col, color_by_name]
        else:
            df_grouped.index.name = x_axis_col
        df_grouped.reset_index(inplace=True)
        df_grouped.rename(columns={y_axis: y_axis_col}, inplace=True)


    if chart_type == "trend" or chart_type == "number":
        # when chart_type is trend or number, we need to actually sort the dataframe
        # because we'll pick up to the the last 2 points manually
        df_grouped = df_grouped.sort_values(by=x_axis_col, ascending=x_axis_sort == "ascending")

    capped = False
    if len(df_grouped) > 10000:
        if chart_type == "trend" or chart_type == "number":
            # when chart_type is trend, we only care about up to the 2 last
            # so we take the tail and consider that the data is not capped
            df_grouped = df_grouped.tail(10000)
        else:
            capped = True
            df_grouped = df_grouped.head(10000)


    # Disable max rows in Altair to allow for larger datasets
    alt.data_transformers.disable_max_rows()

    x_title = f"{x_axis_col} ({x_axis_group_func})" if x_axis_group_func else x_axis_col
    if x_axis_name:
        x_title = x_axis_name

    y_title = f"{y_axis_col} ({y_axis_agg_func})" if y_axis_agg_func else y_axis_col
    if y_axis_name:
        y_title = y_axis_name

    x_time_unit = None
    if x_axis_type == "T":
        x_time_unit = "yearmonthdatehoursminutesseconds"
        if x_axis_group_func:
            if x_axis_group_func == "year":
                x_time_unit = "year"
            elif x_axis_group_func == "month":
                x_time_unit = "yearmonth"
            elif x_axis_group_func == "quarter":
                x_time_unit = "yearquarter"
            elif x_axis_group_func == "week":
                x_time_unit = "yearweek"
            elif x_axis_group_func == "date":
                x_time_unit = "yearmonthdate"
            elif x_axis_group_func == "hours":
                x_time_unit = "yearmonthdatehours"
            elif x_axis_group_func == "minutes":
                x_time_unit = "yearmonthdatehoursminutes"
            elif x_axis_group_func == "seconds":
                x_time_unit = "yearmonthdatehoursminutesseconds"


        axis = alt.Axis(labelOverlap=True, grid=False, titlePadding=axisTitlePadding, ticks=False, labelPadding=6)
        x = alt.X(f"{x_axis_col}:{x_axis_type}", title=x_title, timeUnit=x_time_unit, axis=axis, bandPosition=0)
    else:
        t = x_axis_type
        if x_axis_type == "Q" and chart_type == "groupedColumn" and color_by:
            t = "O"
        axis = alt.Axis(labelOverlap=True, grid=False, titlePadding=axisTitlePadding, ticks=False, labelPadding=6)
        if number_values_format and x_axis_type == "Q":
            axis.format = number_values_format

        x = alt.X(f"{x_axis_col}:{t}", title=x_title, axis=axis)

    if chart_type == "scatterPlot":
        x = x.scale(zero=False, reverse=True if x_axis_sort == "descending" else False)
    else:
        x = x.scale(reverse=True if x_axis_sort == "descending" else False)

    y_time_unit = None
    if y_axis_type == "T":
        y_time_unit = "yearmonthdatehoursminutesseconds"
        if y_axis_agg_func:
            if y_axis_agg_func == "year":
                y_time_unit = "year"
            elif y_axis_agg_func == "month":
                y_time_unit = "yearmonth"
            elif y_axis_agg_func == "quarter":
                y_time_unit = "yearquarter"
            elif y_axis_agg_func == "week":
                y_time_unit = "yearmonthweek"
            elif y_axis_agg_func == "date":
                y_time_unit = "yearmonthdate"
            elif y_axis_agg_func == "hours":
                y_time_unit = "yearmonthdatehours"
            elif y_axis_agg_func == "minutes":
                y_time_unit = "yearmonthdatehoursminutes"
            elif y_axis_agg_func == "seconds":
                y_time_unit = "yearmonthdatehoursminutesseconds"
        axis = alt.Axis(labelOverlap=True, gridDash=[4, 4], domain=False, ticks=False, titlePadding=axisTitlePadding)
        y = alt.Y(f"{y_axis_col}:O", title=y_title, timeUnit=y_time_unit, axis=axis)
    else:
        axis = alt.Axis(labelOverlap=True, gridDash=[4, 4], domain=False, ticks=False, titlePadding=axisTitlePadding)
        if number_values_format and y_axis_type == "Q":
            axis.format = number_values_format

        y = alt.Y(f"{y_axis_col}:{y_axis_type}", title=y_title, axis=axis)

    if chart_type == "hundredPercentStackedArea" or chart_type == "hundredPercentStackedColumn":
        y = y.stack("normalize")
    elif chart_type == "scatterPlot":
        y = y.scale({ "zero": False })

    tooltip = []
    if chart_type != "histogram":
        if x_time_unit:
            tooltip.append(alt.Tooltip(f"{x_axis_col}:T", title=x_title, timeUnit=x_time_unit))
        else:
            ttp = alt.Tooltip(f"{x_axis_col}:{x_axis_type}", title=x_title)
            if number_values_format and x_axis_type == "Q":
                ttp.format = number_values_format
            tooltip.append(ttp)

        if y_time_unit:
            tooltip.append(alt.Tooltip(f"{y_axis_col}:T", title=y_title, timeUnit=y_time_unit))
        else:
            ttp = alt.Tooltip(f"{y_axis_col}:{y_axis_type}", title=y_title)
            if number_values_format and y_axis_type == "Q":
                ttp.format = number_values_format
            tooltip.append(ttp)

        if chart_type == "hundredPercentStackedArea" or chart_type == "hundredPercentStackedColumn":
            try:
                df_grouped["_briefer_total"] = df_grouped.groupby(x_axis_col)[y_axis_col].transform("sum")
                df_grouped["_briefer_normalize"] = df_grouped[y_axis_col] / df_grouped["_briefer_total"]
                tooltip.append(alt.Tooltip("_briefer_normalize", title="percentage", format=".1%"))
            except:
                pass

        if color_by:
            ttp = alt.Tooltip(f"{color_by_name}:{color_by_type}", title=color_by)
            if number_values_format and color_by_type == "Q":
                ttp.format = number_values_format
            tooltip.append(ttp)

    if x_axis_type == "T":
        df_grouped.loc[:, x_axis_col] = df_grouped[x_axis_col].apply(lambda x: x.isoformat() if pd.notnull(x) else x)

    if y_axis_type == "T":
        df_grouped.loc[:, y_axis_col] = df_grouped[y_axis_col].apply(lambda x: x.isoformat() if pd.notnull(x) else x)


    # Create the chart with Altair
    base = alt.Chart(df_grouped, width=600, height=400).encode(
        x=x,
        y=y,
        tooltip=tooltip
    )

    # Choose the Altair mark based on the chartType argument
    if chart_type == "groupedColumn" or chart_type == "trend" or chart_type == "number":
        chart = base.mark_bar(color=color)
    elif chart_type == "line":
        chart = base.mark_line(
          color=color,
          point=alt.OverlayMarkDef(color=color)
        )
    elif chart_type == "stackedColumn":
        if color_by:
          chart = base.mark_bar().encode(
            color=alt.Color(f"{color_by_name}:{color_by_type}", title=color_by)
          )
        else:
          chart = base.mark_bar(color=color)
    elif chart_type == "area" or chart_type == "hundredPercentStackedArea":
        chart = base.mark_area(
          opacity=0.3,
          line=alt.OverlayMarkDef(color=color),
          point=alt.OverlayMarkDef(color=color),
          color=color
        )
    elif chart_type == "scatterPlot":
        chart = base.mark_circle(color=color)
    else:
        # Default is bar
        chart = base.mark_bar(color=color)

    noXOffset = set(["line", "area", "stackedColumn", "hundredPercentStackedArea", "hundredPercentStackedColumn"])

    if color_by:
        orient = "right"
        legend_offset = 0

        # if there are 6 or fewer legend items, show them on top and use padding
        if len(df_grouped[color_by_name].unique()) <= 6:
            orient = "top"
            legend_offset = 28

        legend = alt.Legend(title=None, orient=orient, offset=legend_offset, labelFontSize=12, symbolType="circle", labelFontWeight=500)

        if chart_type in noXOffset:
          chart = chart.encode(color=alt.Color(f"{color_by_name}:{color_by_type}", title=color_by, legend=legend))
        else:
          chart = chart.encode(
              color=alt.Color(f"{color_by_name}:{color_by_type}", title=color_by, legend=legend),
              xOffset=alt.XOffset(f"{color_by_name}:{color_by_type}")
          )

    if show_data_labels:
        align = 'center'

        y = alt.Y(f"{y_axis_col}:{y_axis_type}", title=y_title)
        if chart_type == "hundredPercentStackedArea" or chart_type == "hundredPercentStackedColumn":
            y = y.stack("normalize")
        elif chart_type == "stackedColumn" or chart_type == "area":
            y = y.stack('zero')

        text_chart = chart.mark_text(align=align, baseline='bottom', dx=0, dy=-4).encode(x=x, y=y)

        if number_values_format and y_axis_type == "Q":
            text_chart = text_chart.encode(text=alt.Text(f"{y_axis_col}:{y_axis_type}", format=number_values_format))
        else:
            text_chart = text_chart.encode(text=f"{y_axis_col}:{y_axis_type}")

        if color_by:
            color = alt.Color(f"{color_by_name}:{color_by_type}")
            text_chart = text_chart.encode(color=color)
            if not (chart_type in noXOffset):
                x_offset = alt.XOffset(f"{color_by_name}:{color_by_type}")
                text_chart = text_chart.encode(xOffset=x_offset)

        # On stacked columns, show single label with sum on top
        if chart_type == "stackedColumn":
            text_chart = base.mark_text(align=align, baseline='bottom', dx=0, dy=-4).transform_aggregate(
                sum_value=f"sum({y_axis_col})",
                groupby=[x_axis_col]
            ).encode(y=alt.Y(f"sum_value:Q", stack='zero'), text=alt.Text("sum_value:Q"))


        chart = chart + text_chart

    return chart, capped

def _briefer_create_visualization(
    df,
    chart_type,
    x_axis,
    x_axis_name,
    x_axis_type,
    x_axis_group_func,
    x_axis_sort,
    y_axes,
    histogram_format,
    histogram_bin,
    show_data_labels,
    number_values_format,
    filtering
):
    # when x_axis is None we create a integer column to use as x_axis
    if x_axis is None:
        x_axis = "_briefer_index"
        df.loc[:, x_axis] = range(1, len(df) + 1)
        x_axis_type = "Q"

    colors = [
        "#4c78a8",
        "#f58518",
        "#e45756",
        "#72b7b2",
        "#54a24b",
        "#eeca3b",
        "#b279a2",
        "#ff9da6",
        "#9d755d",
        "#bab0ac"
    ]

    timedeltas = set([
      'timedelta64',
      'timedelta64[ns]',
      'timedelta64[ns, UTC]',
      'timedelta64[us]',
      'timedelta64[us, UTC]'
    ])
    periods = set([
      'period',
      'period[Y-DEC]',
      'period[Q-DEC]',
      'period[M]',
      'period[Q]',
      'period[W]',
      'period[D]',
      'period[h]',
      'period[min]',
      'period[m]',
      'period[s]',
      'period[ms]',
      'period[us]',
      'period[ns]'
    ])

    # Convert columns to Altair supported types
    for col in df.columns:
        # if type of col is timedelta64, convert it to seconds
        if df[col].dtype.name in timedeltas:
            df[col] = df[col].dt.total_seconds().astype('Float64')
        elif df[col].dtype.name in periods:
            df[col] = df[col].dt.to_timestamp().astype('datetime64[ns]')

    # Convert to datetime if x_axis is of type "T"
    if x_axis_type == "T":
        df.loc[:, x_axis] = pd.to_datetime(df[x_axis])

    for filter in filtering:
        column_name = filter['column']['name']
        operator = filter['operator']

        value = _briefer_render_filter_value(filter)

        # if the value is None, rendering failed, skip this filter
        if value == None:
            continue

        if filter["value"] != value:
            filter["renderedValue"] = value
            print(json.dumps({"type": "filter-result", "filter": filter}))

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
        elif pd.api.types.is_bool_dtype(df[column_name]):
            if operator == 'isTrue':
                df = df[df[column_name]]
            elif operator == 'isFalse':
                df = df[~df[column_name]]
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

    def _briefer_create_histogram(
        df,
        x_axis,
        x_axis_name,
        x_axis_type,
        x_axis_group_func,
        x_axis_sort,
        y_axes,
        histogram_format,
        histogram_bin,
        number_values_format,
        show_data_labels
    ):
        if x_axis_type == "T":
            df.loc[:, x_axis] = pd.to_datetime(df[x_axis])

        if x_axis_type == "T":
            x_time_unit = "yearmonthdatehoursminutesseconds"
            if x_axis_group_func:
                if x_axis_group_func == "year":
                    x_time_unit = "year"
                elif x_axis_group_func == "month":
                    x_time_unit = "yearmonth"
                elif x_axis_group_func == "quarter":
                    x_time_unit = "yearquarter"
                elif x_axis_group_func == "week":
                    x_time_unit = "yearweek"
                elif x_axis_group_func == "date":
                    x_time_unit = "yearmonthdate"
                elif x_axis_group_func == "hours":
                    x_time_unit = "yearmonthdatehours"
                elif x_axis_group_func == "minutes":
                    x_time_unit = "yearmonthdatehoursminutes"
                elif x_axis_group_func == "seconds":
                    x_time_unit = "yearmonthdatehoursminutesseconds"

            axis = alt.Axis(labelOverlap=True, titlePadding=axisTitlePadding)
            x = alt.X(f"{x_axis}:{x_axis_type}", title=x_axis_name, timeUnit=x_time_unit, axis=axis)
        else:
            t = x_axis_type
            axis = alt.Axis(labelOverlap=True, titlePadding=axisTitlePadding)
            if number_values_format and x_axis_type == "Q":
                axis.format = number_values_format

            x = alt.X(f"{x_axis}:{t}", title=x_axis_name, axis=axis)

        bin = alt.Bin()
        if histogram_bin["type"] == "stepSize":
            bin = alt.Bin(anchor=0, step=histogram_bin["value"])
        elif histogram_bin["type"] == "maxBins":
            bin = alt.Bin(anchor=0, maxbins=histogram_bin["value"])

        if histogram_format == "count":
            chart = alt.Chart(df, width=600, height=400).mark_bar(binSpacing=2).encode(
                x=alt.X('bin_start:O', title=x_axis_name),
                y=alt.Y(
                    "count()" if histogram_format == "count" else "percentage",
                    title="Count" if histogram_format == "count" else "Percentage",
                    stack="normalize" if histogram_format == "percentage" else None
                ),
                tooltip=[
                    alt.Tooltip("bin_range:N", title=x_axis_name),
                    alt.Tooltip("count()" if histogram_format == "count" else "percentage",
                                title="Count" if histogram_format == "count" else "Percentage")
                ]
            ).transform_bin(
                as_=["bin_start", "bin_end"],
                field=x_axis,
                bin=bin
            ).transform_calculate(
                bin_range="[datum.bin_start + ', ' + datum.bin_end]"
            )

            if show_data_labels:
                chart = chart + chart.mark_text(align='center', baseline='bottom', dx=0, dy=-5, fontSize=10, xOffset=0).encode(text="count()")
        elif histogram_format == "percentage":
            chart = alt.Chart(df, width=600, height=400).mark_bar(binSpacing=2).encode(
                x=alt.X('bin_start:O', title=x_axis_name),
                y=alt.Y(
                    'percentage:Q',
                    title="Percentage",
                    stack=None,
                    axis=alt.Axis(format=".0%")
                ),
                tooltip=[
                    alt.Tooltip("bin_range:N", title=x_axis_name),
                    alt.Tooltip('percentage:Q', title="Percentage", format=".1%")
                ]
            ).transform_bin(
                as_=["bin_start", "bin_end"],
                field=x_axis,
                bin=bin
            ).transform_aggregate(
                sum_value=f"sum({x_axis})",
                groupby=["bin_start", "bin_end"]
            ).transform_window(
                total_sum='sum(sum_value)',
                frame=[None, None]
            ).transform_calculate(
                bin_range="[datum.bin_start + ', ' + datum.bin_end]",
                percentage="datum.sum_value / datum.total_sum"
            )

            if show_data_labels:
                chart = chart + chart.mark_text(align='center', baseline='bottom', dx=0, dy=-5, fontSize=10, xOffset=0).encode(text=alt.Text('percentage:Q', format=".1%"))

        return chart, False


    usermeta = {
      "actual_size": len(df),
      "capped": False
    }

    layers = []
    if chart_type == "histogram":
        chart, capped = _briefer_create_histogram(
            df,
            x_axis,
            x_axis_name,
            x_axis_type,
            x_axis_group_func,
            x_axis_sort,
            y_axes,
            histogram_format,
            histogram_bin,
            number_values_format,
            show_data_labels
        )
        layers.append(chart)

        if capped:
            usermeta["capped"] = True
    elif chart_type == "trend" or chart_type == "number":
        # trend or number chart spec are computed as a grouped column chart that only
        # supports one y-axis and one series and do not support color by
        y_axis = y_axes[0]
        series = y_axis['series'][0]
        color = colors[0]

        # if no y or y is not numeric, return
        is_y_numeric = series["column"]["type"] == "Q"
        if not series['column'] or not is_y_numeric:
            print(json.dumps({"type": "result", "success": False, "reason": "invalid-params"}))
            return

        chart, capped = _briefer_create_chart(
            df.copy(),
            chart_type,
            x_axis,
            x_axis_name,
            x_axis_type,
            x_axis_group_func,
            x_axis_sort,
            y_axis.get('name', None),
            series['column']['name'],
            series['column']['type'],
            series['aggregateFunction'],
            None,
            None,
            number_values_format,
            show_data_labels,
            color
        )
        layers.append(chart)

        if capped:
            usermeta["capped"] = True
    else:
        i = 0
        for y_axis in y_axes:
            series = []

            if len(y_axis['series']) == 0:
                continue

            for serie in y_axis['series']:
                if not serie['column']:
                    continue

                ct = serie.get('chartType', None)
                if not ct:
                    ct = chart_type
                color = colors[i % len(colors)]

                color_by = serie.get('colorBy', None)
                # if df is empty, color_by is not valid, ignore it
                if len(df) == 0:
                    color_by = None

                chart, capped = _briefer_create_chart(
                    df.copy(),
                    ct,
                    x_axis,
                    x_axis_name,
                    x_axis_type,
                    x_axis_group_func,
                    x_axis_sort,
                    serie.get('axisName', None),
                    serie['column']['name'],
                    serie['column']['type'],
                    serie['aggregateFunction'],
                    color_by["name"] if color_by else None,
                    color_by["type"] if color_by else None,
                    number_values_format,
                    show_data_labels,
                    color
                )
                series.append(chart)

                if capped:
                    usermeta["capped"] = True

                i += 1

            layer = alt.layer(*series)
            i += 1

            layers.append(layer)

    vis = alt.layer(*layers, usermeta=usermeta).resolve_scale(y='independent').configure_view(stroke=None).configure_range(category={"scheme": "tableau20"})

    x_axis_timezone = None
    # if xAxis is time like
    if x_axis_type == "T":
        # compute timezone
        try:
            x_axis_timezone = _briefer_get_timezone(df[x_axis])
        except:
            pass

    # return spec as json
    print(json.dumps({"type": "result", "success": True, "spec": vis.to_json(default=str), "xAxisTimezone": x_axis_timezone}, default=str))

if not "${dataframe.name}" in globals():
    try:
        import pandas as pd
        ${dataframe.name} = pd.read_parquet("/home/jupyteruser/.briefer/query-${
    dataframe.id
  }.parquet.gzip")
    except:
        pass

if "${dataframe.name}" in globals():
    _briefer_create_visualization(
        ${dataframe.name}.copy(),
        "${chartType}",
        ${xAxis ? JSON.stringify(xAxis.name) : 'None'},
        ${xAxisName ? `"${xAxisName}"` : 'None'},
        ${xAxis ? JSON.stringify(dfTypeToAltairType(xAxis.type)) : 'None'},
        ${xAxisAggregateFunction ? `"${xAxisAggregateFunction}"` : 'None'},
        "${xAxisSort}",
        json.loads(${JSON.stringify(JSON.stringify(pythonYAxes))}),
        ${JSON.stringify(histogramFormat)},
        json.loads(${JSON.stringify(JSON.stringify(histogramBin))}),
        json.loads(${JSON.stringify(JSON.stringify(showDataLabels))}),
        ${numberValuesFormat ? `"${numberValuesFormat}"` : 'None'},
        json.loads(${JSON.stringify(JSON.stringify(filtering))})
    )
else:
    print(json.dumps({"type": "result", "success": False, "reason": "dataframe-not-found"}))`

  return code
}

const CreateVisualizationPythonResult = z.union([
  z.object({
    type: z.literal('result'),
    success: z.literal(true),
    spec: jsonString.pipe(JsonObject),
    xAxisTimezone: z.string().nullable(),
  }),
  z.object({
    type: z.literal('result'),
    success: z.literal(false),
    reason: z.union([
      z.literal('dataframe-not-found'),
      z.literal('aborted'),
      z.literal('invalid-params'),
    ]),
  }),
])
type CreateVisualizationPythonResult = z.infer<
  typeof CreateVisualizationPythonResult
>

const FilterResult = z.object({
  type: z.literal('filter-result'),
  filter: VisualizationFilter,
})
type FilterResult = z.infer<typeof FilterResult>

export type CreateVisualizationResult = {
  promise: Promise<
    | {
        success: true
        spec: JsonObject
        filterResults: Record<string, VisualizationFilter>
        xAxisTimezone: string | null
      }
    | {
        success: false
        reason: 'dataframe-not-found' | 'aborted' | 'invalid-params'
        filterResults: Record<string, VisualizationFilter>
      }
  >
  abort: () => Promise<void>
}

export function isValidD3Format(f: string): boolean {
  try {
    d3Format(f)
    return true
  } catch (e) {
    return false
  }
}

export async function createVisualization(
  workspaceId: string,
  sessionId: string,
  dataframe: DataFrame,
  chartType: ChartType,
  xAxisColumn: DataFrameColumn | null,
  xAxisName: string | null,
  xAxisGroupFunction: TimeUnit | null,
  xAxisSort: Order,
  yAxes: YAxis[],
  histogramFormat: HistogramFormat,
  histogramBin: HistogramBin,
  showDataLabels: boolean,
  numberValuesFormat: string | null,
  filters: VisualizationFilter[]
): Promise<CreateVisualizationResult> {
  const validFilters: FinishedVisualizationFilter[] = []
  for (const f of filters) {
    if (isUnfinishedVisualizationFilter(f)) {
      continue
    }

    validFilters.push(f)
  }

  await getJupyterManager().ensureRunning(workspaceId)

  const namespace = `jupyter-${workspaceId}`

  const code = getCode(
    dataframe,
    chartType,
    xAxisColumn,
    xAxisName,
    xAxisGroupFunction,
    xAxisSort,
    yAxes,
    histogramFormat,
    histogramBin,
    showDataLabels,
    numberValuesFormat && isValidD3Format(numberValuesFormat)
      ? numberValuesFormat
      : null,
    validFilters
  )

  let outputs: Output[] = []
  const { promise: execute, abort } = await executeCode(
    workspaceId,
    sessionId,
    code,
    (newOutputs) => {
      outputs = outputs.concat(newOutputs)
    },
    { storeHistory: false }
  )

  const filterResults: Record<string, VisualizationFilter> = {}

  const promise = execute.then(
    async (): CreateVisualizationResult['promise'] => {
      let result: CreateVisualizationPythonResult | null = null
      const errors: Error[] = []
      for (const output of outputs) {
        if (output.type === 'error') {
          if (output.ename === 'KeyboardInterrupt') {
            result = { type: 'result', success: false, reason: 'aborted' }
            break
          }

          errors.push(
            new Error(
              `Failed to create visualization:\n${JSON.stringify(
                output,
                null,
                2
              )}`
            )
          )
          continue
        }

        if (output.type === 'stdio') {
          if (output.name === 'stdout') {
            for (const line of output.text.split('\n')) {
              try {
                const asJson = JSON.parse(line)
                const parsed =
                  CreateVisualizationPythonResult.or(FilterResult).safeParse(
                    asJson
                  )
                if (parsed.success) {
                  if (parsed.data.type === 'result') {
                    if (parsed.data.success) {
                      result = parsed.data
                      break
                    }
                  } else {
                    filterResults[parsed.data.filter.id] = parsed.data.filter
                  }
                }
              } catch (err) {
                errors.push(err as Error)
              }
            }
          } else {
            errors.push(new Error(`Got stderr output: ${output.text}`))
          }
          continue
        }
      }

      if (!result) {
        errors.push(new Error('Failed to create visualization, no result'))
        const err = new AggregateError(errors)
        logger().error(
          { outputs, namespace, err },
          'Failed to create visualization'
        )
        throw err
      }

      if (!result.success) {
        return { ...result, filterResults }
      }

      return {
        success: true,
        spec: result.spec,
        filterResults,
        xAxisTimezone: result.xAxisTimezone,
      }
    }
  )

  return {
    promise,
    abort,
  }
}
