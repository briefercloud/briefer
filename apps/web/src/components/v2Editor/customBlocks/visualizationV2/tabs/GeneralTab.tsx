import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChartType,
  DataFrame,
  DataFrameColumn,
  NumpyDateTypes,
  NumpyNumberTypes,
  NumpyTimeDeltaTypes,
  TimeUnit,
  HistogramFormat,
  HistogramBin,
  YAxisV2,
} from '@briefer/types'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import ChartTypeSelector from '@/components/ChartTypeSelector'
import AxisSelector from '@/components/AxisSelector'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import { PortalTooltip } from '@/components/Tooltips'
import { sortWith } from 'ramda'
import YAxisPickerV2 from '../YAxisPicker'
import useResettableState from '@/hooks/useResettableState'
import clsx from 'clsx'

interface GeneralTabProps {
  dataframe: DataFrame | null
  chartType: ChartType
  onChangeChartType: (chartType: ChartType) => void
  xAxis: DataFrameColumn | null
  onChangeXAxis: (column: DataFrameColumn | null) => void
  xAxisSort: 'ascending' | 'descending'
  onChangeXAxisSort: (sort: 'ascending' | 'descending') => void
  xAxisGroupFunction: TimeUnit | null
  onChangeXAxisGroupFunction: (groupFunction: TimeUnit | null) => void
  histogramFormat: HistogramFormat
  onChangeHistogramFormat: (format: HistogramFormat) => void
  histogramBin: HistogramBin
  onChangeHistogramBin: (bin: HistogramBin) => void
  yAxes: YAxisV2[]
  onChangeYAxes: (yAxes: YAxisV2[]) => void
  onChangeYAxis: (yAxis: YAxisV2, index: number) => void
  onRemoveYAxis: (index: number) => void
  onAddYAxis: () => void
  isEditable: boolean
}

const GeneralTab = ({
  dataframe,
  chartType,
  onChangeChartType,
  xAxis,
  onChangeXAxis,
  xAxisSort,
  onChangeXAxisSort,
  xAxisGroupFunction,
  onChangeXAxisGroupFunction,
  histogramFormat,
  onChangeHistogramFormat,
  histogramBin,
  onChangeHistogramBin,
  yAxes,
  onChangeYAxes,
  onChangeYAxis,
  onRemoveYAxis,
  onAddYAxis,
  isEditable,
}: GeneralTabProps) => {
  const onChangeXAxisGroupFunctionHandler = useCallback(
    (groupFunction: string | null) => {
      if (groupFunction === null) {
        onChangeXAxisGroupFunction(null)
        return
      }

      const timeUnit = TimeUnit.safeParse(groupFunction)
      if (timeUnit.success) {
        onChangeXAxisGroupFunction(timeUnit.data)
        return
      }
    },
    [onChangeXAxisGroupFunction]
  )

  const onChangeXAxisSortHandler = useCallback(
    (sort: string | null) => {
      if (sort === 'ascending' || sort === 'descending') {
        onChangeXAxisSort(sort)
      } else {
        onChangeXAxisSort('ascending')
      }
    },
    [onChangeXAxisSort]
  )

  const onChangeHistogramFormatHandler = useCallback(
    (format: string | null) => {
      const parsed = HistogramFormat.safeParse(format)
      if (parsed.success) {
        onChangeHistogramFormat(parsed.data)
      }
    },
    [onChangeHistogramFormat]
  )

  const onChangeHistogramBinHandler = useCallback(
    (bin: string | null) => {
      if (bin === 'auto') {
        onChangeHistogramBin({ type: 'auto' })
        return
      }

      if (bin === 'stepSize') {
        onChangeHistogramBin({ type: 'stepSize', value: 1 })
        return
      }

      if (bin === 'maxBins') {
        onChangeHistogramBin({ type: 'maxBins', value: 10 })
        return
      }
    },
    [onChangeHistogramBin]
  )

  const [binText, setBinText] = useResettableState<string>(
    () => (histogramBin.type === 'maxBins' ? '10' : '1'),
    [histogramBin.type]
  )

  const onChangeBinText: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        setBinText(e.target.value)
      },
      [setBinText]
    )

  useEffect(() => {
    if (histogramBin.type === 'auto') {
      return
    }

    if (histogramBin.type === 'stepSize') {
      const value = parseFloat(binText)
      if (Number.isNaN(value) || value <= 0) {
        return
      }

      onChangeHistogramBin({ type: 'stepSize', value })
      return
    }

    if (histogramBin.type === 'maxBins') {
      const value = Number(binText)
      if (Number.isNaN(value) || !Number.isInteger(value) || value < 2) {
        return
      }

      onChangeHistogramBin({ type: 'maxBins', value })
      return
    }
  }, [histogramBin.type, binText, onChangeHistogramBin])

  const binError = useMemo(() => {
    if (histogramBin.type === 'auto') {
      return null
    }

    if (histogramBin.type === 'stepSize') {
      const value = parseFloat(binText)
      if (isNaN(value) || value <= 0) {
        return 'Must be a positive number.'
      }

      return null
    }

    if (histogramBin.type === 'maxBins') {
      const value = Number(binText)
      if (Number.isNaN(value) || !Number.isInteger(value)) {
        return 'Must be an integer.'
      }

      if (value < 2) {
        return 'Must be at least 2.'
      }

      return null
    }
  }, [histogramBin.type, binText])

  const onChangeChartTypeHandler = useCallback(
    (chartType: ChartType) => {
      // if only one y-axis is present, reset the chart type of the series
      if (yAxes.length === 1) {
        onChangeYAxes([
          {
            ...yAxes[0],
            series: yAxes[0].series.map((s) => ({
              ...s,
              chartType: null,
            })),
          },
        ])
      }

      onChangeChartType(chartType)
    },
    [onChangeChartType, yAxes, onChangeYAxes]
  )

  const defaultXAxisColumn: DataFrameColumn | null = useMemo(() => {
    switch (chartType) {
      case 'trend':
      case 'number':
        return null
      case 'histogram':
        return (
          dataframe?.columns.filter(
            (c) =>
              NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(c.type).success
          )[0] ?? null
        )
      case 'pie':
      case 'line':
      case 'area':
      case 'scatterPlot':
      case 'groupedColumn':
      case 'stackedColumn':
      case 'hundredPercentStackedArea':
      case 'hundredPercentStackedColumn':
        return (
          sortWith(
            [
              (a, b) =>
                NumpyDateTypes.safeParse(a.type).success ===
                NumpyDateTypes.safeParse(b.type).success
                  ? 0
                  : NumpyDateTypes.safeParse(a.type).success
                    ? -1
                    : 1,
              (a, b) =>
                (a.type === 'str') === (b.type === 'str')
                  ? 0
                  : a.type === 'str'
                    ? -1
                    : 1,
              (a, b) =>
                NumpyNumberTypes.safeParse(a.type).success ===
                NumpyNumberTypes.safeParse(b.type).success
                  ? 0
                  : NumpyNumberTypes.safeParse(a.type).success
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
            dataframe?.columns ?? []
          )[0] ?? null
        )
    }
  }, [chartType, dataframe?.columns])

  return (
    <div className="text-xs text-gray-500 flex flex-col space-y-8">
      {yAxes.length > 1 || yAxes.some((y) => y.series.length > 1) ? null : (
        <div>
          <ChartTypeSelector
            label="Chart Type"
            value={chartType}
            onChange={onChangeChartTypeHandler}
            isEditable={isEditable}
          />
        </div>
      )}

      <div>
        <AxisSelector
          label={
            chartType === 'trend' || chartType === 'number' ? (
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium leading-6 text-gray-900">
                  Period{' '}
                  <span className="text-[10px] font-normal text-gray-400">
                    (optional)
                  </span>
                </span>

                <PortalTooltip
                  content={
                    <div className="font-sans bg-hunter-950 text-gray-400 text-center text-xs p-2 rounded-md w-64 -translate-x-1/2">
                      If provided, this column will be used to sort the data
                      before picking the number.
                    </div>
                  }
                >
                  <QuestionMarkCircleIcon
                    className="h-4 w-4 text-gray-300"
                    aria-hidden="true"
                  />
                </PortalTooltip>
              </div>
            ) : (
              'X-Axis'
            )
          }
          value={xAxis}
          columns={[
            ...(chartType === 'number' || chartType === 'trend' ? [null] : []),
            ...(dataframe?.columns ?? []).filter((c) =>
              chartType === 'histogram'
                ? NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(c.type)
                    .success
                : chartType === 'number' || chartType === 'trend'
                  ? NumpyDateTypes.safeParse(c.type).success
                  : true
            ),
          ]}
          onChange={onChangeXAxis}
          disabled={!dataframe || !isEditable}
          defaultValue={defaultXAxisColumn}
        />
        <div className="flex flex-col gap-y-1 pt-1 px-0.5">
          {xAxis &&
            chartType !== 'histogram' &&
            NumpyDateTypes.safeParse(xAxis.type).success && (
              <AxisModifierSelector
                label={chartType === 'trend' ? 'Compare by' : 'Group by'}
                value={xAxisGroupFunction}
                options={[
                  { name: 'None', value: null },
                  { name: 'Year', value: 'year' },
                  { name: 'Quarter', value: 'quarter' },
                  { name: 'Month', value: 'month' },
                  { name: 'Week', value: 'week' },
                  { name: 'Date', value: 'date' },
                  { name: 'Hours', value: 'hours' },
                  { name: 'Minutes', value: 'minutes' },
                  { name: 'Seconds', value: 'seconds' },
                ]}
                onChange={onChangeXAxisGroupFunctionHandler}
                disabled={!dataframe || !isEditable}
              />
            )}
          {chartType === 'histogram' ? (
            <>
              <AxisModifierSelector
                label="Format"
                value={histogramFormat}
                options={[
                  { name: 'Count', value: 'count' },
                  { name: 'Percentage', value: 'percentage' },
                ]}
                onChange={onChangeHistogramFormatHandler}
                disabled={!dataframe || !isEditable}
              />
              <AxisModifierSelector
                label="Bin by"
                value={histogramBin.type}
                options={[
                  { name: 'Auto', value: 'auto' },
                  { name: 'Step size', value: 'stepSize' },
                  { name: 'Max bins', value: 'maxBins' },
                ]}
                onChange={onChangeHistogramBinHandler}
                disabled={!dataframe || !isEditable}
              />
              {histogramBin.type !== 'auto' && (
                <div>
                  <div className="flex items-center gap-x-1">
                    <label
                      htmlFor="histogramBin"
                      className="text-xs text-gray-500 flex-1"
                    >
                      {histogramBin.type === 'stepSize'
                        ? 'Step size'
                        : 'Max bins'}
                    </label>
                    <input
                      type="number"
                      name="histogramBin"
                      value={binText}
                      onChange={onChangeBinText}
                      className={clsx(
                        'truncate border-0 text-xs px-2 bg-transparent font-mono placeholder:text-gray-400 text-right hover:ring-1 hover:ring-inset hover:ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 rounded-md h-6 w-20',
                        binError && 'ring-red-500 focus:ring-red-500'
                      )}
                      disabled={!dataframe || !isEditable}
                    />
                  </div>
                  <div className="flex justify-end text-red-600 text-xs pt-1">
                    <span>{binError}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            <AxisModifierSelector
              label={chartType === 'number' ? 'Choosen value' : 'Sort'}
              value={xAxisSort}
              options={[
                {
                  name: chartType === 'number' ? 'Last' : 'Ascending',
                  value: 'ascending',
                },
                {
                  name: chartType === 'number' ? 'First' : 'Descending',
                  value: 'descending',
                },
              ]}
              onChange={onChangeXAxisSortHandler}
              disabled={!dataframe || !isEditable}
            />
          )}
        </div>
      </div>
      {chartType !== 'histogram' && (
        <div className="flex flex-col space-y-6">
          {yAxes
            .slice(
              0,
              chartType === 'trend' || chartType === 'number' ? 1 : undefined
            )
            .map((yAxis, i) => (
              <YAxisPickerV2
                yAxis={yAxis}
                index={i}
                key={i}
                onChange={onChangeYAxis}
                isEditable={isEditable}
                dataframe={dataframe}
                onRemove={i === 1 ? onRemoveYAxis : undefined}
                onAddYAxis={
                  i === 0 &&
                  yAxes.length === 1 &&
                  chartType !== 'trend' &&
                  chartType !== 'number'
                    ? onAddYAxis
                    : undefined
                }
                defaultChartType={chartType}
              />
            ))}
        </div>
      )}
    </div>
  )
}

export default GeneralTab
