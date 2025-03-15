import { v4 as uuidv4 } from 'uuid'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import AxisSelector from '@/components/AxisSelector'
import ChartTypeSelector from '@/components/ChartTypeSelector'
import {
  AggregateFunction,
  ChartType,
  DataFrame,
  DataFrameColumn,
  NumpyNumberTypes,
  NumpyTimeDeltaTypes,
  DataFrameNumberColumn,
  DataFrameDateColumn,
  DataFrameStringColumn,
  DataFrameBooleanColumn,
  YAxisV2,
  SeriesV2,
  DateFormat,
  NumberFormat,
} from '@briefer/types'
import { sortWith } from 'ramda'
import { useCallback, useMemo } from 'react'
import { createDefaultSeries } from '@briefer/editor'

interface Props {
  index: number
  label?: string
  defaultChartType: ChartType
  yAxis: YAxisV2
  onChange: (yAxis: YAxisV2, i: number) => void
  isEditable: boolean
  dataframe: DataFrame | null
  onRemove?: (i: number) => void
  onAddYAxis?: () => void
}

export function getAggFunction(
  series: SeriesV2,
  column: DataFrameColumn | null
): AggregateFunction {
  if (!column) {
    return series.aggregateFunction ?? 'sum'
  }

  if (NumpyNumberTypes.safeParse(column.type).success) {
    return series.aggregateFunction ?? 'sum'
  }

  return 'count'
}

function YAxisPickerV2(props: Props) {
  const onChangeColumn = useCallback(
    (column: DataFrameColumn | null, index: number) => {
      props.onChange(
        {
          ...props.yAxis,
          series: props.yAxis.series.map((s, i) =>
            i === index
              ? {
                  ...s,
                  column,
                  aggregateFunction: getAggFunction(s, column),
                }
              : s
          ),
        },
        props.index
      )
    },
    [props.onChange, props.index]
  )

  const onChangeAggregateFunction = useCallback(
    (aggregateFunction: string, index: number) => {
      const func = AggregateFunction.safeParse(aggregateFunction)
      if (func.success) {
        props.onChange(
          {
            ...props.yAxis,
            series: props.yAxis.series.map((s, i) =>
              i === index ? { ...s, aggregateFunction: func.data } : s
            ),
          },
          props.index
        )
      }
    },
    [props.onChange, props.yAxis, props.index]
  )

  const onChangeGroupBy = useCallback(
    (colorBy: string | null, index: number) => {
      const column =
        props.dataframe?.columns.find((c) => c.name.toString() === colorBy) ??
        null
      props.onChange(
        {
          ...props.yAxis,
          series: props.yAxis.series.map((s, i) =>
            i === index ? { ...s, groupBy: column } : s
          ),
        },
        props.index
      )
    },
    [props.onChange, props.yAxis, props.dataframe, props.index]
  )

  const onRemoveSerie = useCallback(
    (index: number) => {
      props.onChange(
        {
          ...props.yAxis,
          series: props.yAxis.series.filter((_, i) => i !== index),
        },
        props.index
      )

      if (props.onRemove && props.yAxis.series.length === 1) {
        props.onRemove(props.index)
      }
    },
    [props.onChange, props.yAxis, props.index, props.onRemove]
  )

  const onAddSerie = useCallback(() => {
    props.onChange(
      {
        ...props.yAxis,
        series: [
          ...props.yAxis.series,
          createDefaultSeries(),
        ],
      },
      props.index
    )
  }, [props.onChange, props.yAxis, props.index])

  const onChartTypeChange = useCallback(
    (chartType: ChartType | null, index: number) => {
      props.onChange(
        {
          ...props.yAxis,
          series: props.yAxis.series.map((s, i) =>
            i === index ? { ...s, chartType } : s
          ),
        },
        props.index
      )
    },
    [props.onChange, props.yAxis, props.index]
  )

  const columns = useMemo(
    () =>
      (props.dataframe?.columns ?? []).filter((c) =>
        props.defaultChartType === 'trend' ||
        props.defaultChartType === 'number'
          ? NumpyNumberTypes.safeParse(c.type).success
          : true
      ),
    [props.dataframe, props.defaultChartType]
  )

  const defaultValues = useMemo(
    () =>
      sortWith(
        [
          (a, b) =>
            DataFrameNumberColumn.safeParse(a).success ===
            DataFrameNumberColumn.safeParse(b).success
              ? 0
              : DataFrameNumberColumn.safeParse(a).success
              ? -1
              : 1,
          (a, b) =>
            DataFrameDateColumn.safeParse(a).success ===
            DataFrameDateColumn.safeParse(b).success
              ? 0
              : DataFrameDateColumn.safeParse(a).success
              ? -1
              : 1,
          (a, b) =>
            DataFrameBooleanColumn.safeParse(a).success ===
            DataFrameNumberColumn.safeParse(b).success
              ? 0
              : DataFrameNumberColumn.safeParse(a).success
              ? -1
              : 1,
          (a, b) =>
            DataFrameStringColumn.safeParse(a).success ===
            DataFrameStringColumn.safeParse(b).success
              ? 0
              : DataFrameStringColumn.safeParse(a).success
              ? -1
              : 1,
          // Put columns with 'id' in the name at the end to avoid them being selected by default
          (a, b) =>
            a.name.toString().toLowerCase().includes('id')
              ? 1
              : b.name.toString().toLowerCase().includes('id')
              ? -1
              : 0,
        ],
        columns
      ),
    [columns]
  )

  return (
    <div>
      <div className="flex justify-between items-end pb-1">
        {props.defaultChartType !== 'trend' &&
          props.defaultChartType !== 'number' && (
            <div className="text-md font-medium leading-6 text-gray-900">
              {props.onAddYAxis ? '' : props.index === 0 ? 'Left' : 'Right'}{' '}
              Y-Axis
            </div>
          )}
        {props.onAddYAxis && (
          <button
            className="text-[10px] text-gray-400 underline pb-0.5 hover:text-gray-500"
            onClick={props.onAddYAxis}
          >
            Add Y-Axis
          </button>
        )}
      </div>
      <div className="flex flex-col space-y-6">
        {props.yAxis.series
          .slice(
            0,
            props.defaultChartType === 'trend' ||
              props.defaultChartType === 'number'
              ? 1
              : undefined
          )
          .map((s, i) => (
            <div key={i}>
              <div className="flex space-x-1 items-end relative group">
                <div className="w-full">
                  <AxisSelector
                    label={
                      props.defaultChartType === 'trend'
                        ? 'Primary number'
                        : props.defaultChartType === 'number'
                        ? 'Number'
                        : `Series ${i + 1}`
                    }
                    value={s.column}
                    columns={columns}
                    onChange={(c) => onChangeColumn(c, i)}
                    disabled={!props.dataframe || !props.isEditable}
                    defaultValue={
                      defaultValues[i % defaultValues.length] ?? null
                    }
                  />
                </div>

                {(props.yAxis.series.length > 1 || props.onRemove) && (
                  <button
                    className="flex items-center jutify-center cursor-pointer text-gray-400 hover:text-red-600 text-[10px] absolute top-1 right-1 underline"
                    onClick={() => onRemoveSerie(i)}
                  >
                    Remove
                  </button>
                )}
              </div>
              {props.defaultChartType !== 'trend' &&
                props.defaultChartType !== 'number' &&
                (props.yAxis.series.length > 1 ||
                  !props.onAddYAxis ||
                  (s.chartType && s.chartType !== props.defaultChartType)) && (
                  <ChartTypeSelector
                    value={s.chartType ?? props.defaultChartType}
                    label=""
                    onChange={(t) => onChartTypeChange(t, i)}
                    isEditable={props.isEditable}
                  />
                )}
              {s.column && (
                <div className="flex flex-col gap-y-1 pt-1.5 px-0.5">
                  <AxisModifierSelector
                    label="Aggregate"
                    value={s.aggregateFunction}
                    options={
                      NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(
                        s.column.type
                      ).success
                        ? [
                            { name: 'Sum', value: 'sum' },
                            { name: 'Average', value: 'mean' },
                            { name: 'Median', value: 'median' },
                            { name: 'Min', value: 'min' },
                            { name: 'Max', value: 'max' },
                            { name: 'Count', value: 'count' },
                          ]
                        : [{ name: 'Count', value: 'count' }]
                    }
                    onChange={(agg) => {
                      if (agg) {
                        onChangeAggregateFunction(agg, i)
                      }
                    }}
                    disabled={!props.dataframe || !props.isEditable}
                  />
                  {props.defaultChartType !== 'trend' &&
                    props.defaultChartType !== 'number' && (
                      <AxisModifierSelector
                        label="Group by"
                        value={s.groupBy?.name.toString() ?? null}
                        options={[
                          { name: 'None', value: null },
                          ...(props.dataframe?.columns ?? []).map((c) => ({
                            name: c.name.toString(),
                            value: c.name.toString(),
                          })),
                        ]}
                        onChange={(c) => onChangeGroupBy(c, i)}
                        disabled={!props.dataframe || !props.isEditable}
                      />
                    )}
                </div>
              )}
            </div>
          ))}
      </div>
      {props.defaultChartType !== 'trend' &&
        props.defaultChartType !== 'number' &&
        (props.yAxis.series.length > 1 ||
          props.yAxis.series[0]?.column !== null) && (
          <div className="flex justify-end pt-2">
            <button
              onClick={onAddSerie}
              className="text-[10px] text-gray-400 underline hover:text-gray-500"
            >
              + Series
            </button>
          </div>
        )}
    </div>
  )
}

export default YAxisPickerV2
