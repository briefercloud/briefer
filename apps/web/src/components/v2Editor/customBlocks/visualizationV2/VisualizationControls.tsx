import { format as d3Format } from 'd3-format'
import { QuestionMarkCircleIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import {
  ChartType,
  DataFrame,
  DataFrameColumn,
  NumpyDateTypes,
  NumpyNumberTypes,
  TimeUnit,
  HistogramFormat,
  HistogramBin,
  NumpyTimeDeltaTypes,
  YAxis,
  DataFrameDateColumn,
  DataFrameStringColumn,
  DataFrameNumberColumn,
  YAxisV2,
} from '@briefer/types'
import ChartTypeSelector from '@/components/ChartTypeSelector'
import AxisSelector from '@/components/AxisSelector'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useResettableState from '@/hooks/useResettableState'
import VisualizationSettingsTabsV2, { Tab } from './VisualizationSettingTabs'
import YAxisPickerV2 from './YAxisPicker'
import VisualizationToggleV2 from './VisualizationToggle'
import { PortalTooltip } from '@/components/Tooltips'
import { sortWith, ascend, GT } from 'ramda'
import ScrollBar from '@/components/ScrollBar'

interface Props {
  isHidden: boolean
  dataframe: DataFrame | null
  chartType: ChartType
  onChangeChartType: (chartType: ChartType) => void
  xAxis: DataFrameColumn | null
  onChangeXAxis: (column: DataFrameColumn | null) => void
  xAxisName: string | null
  onChangeXAxisName: (name: string | null) => void
  xAxisSort: 'ascending' | 'descending'
  onChangeXAxisSort: (sort: 'ascending' | 'descending') => void
  xAxisGroupFunction: TimeUnit | null
  onChangeXAxisGroupFunction: (groupFunction: TimeUnit | null) => void
  yAxes: YAxisV2[]
  onChangeYAxes: (yAxes: YAxisV2[]) => void
  histogramFormat: HistogramFormat
  onChangeHistogramFormat: (format: HistogramFormat) => void
  histogramBin: HistogramBin
  onChangeHistogramBin: (bin: HistogramBin) => void
  numberValuesFormat: string | null
  onChangeNumberValuesFormat: (format: string | null) => void
  showDataLabels: boolean
  onChangeShowDataLabels: (showDataLabels: boolean) => void
  isEditable: boolean
}

function isValidD3Format(format: string): boolean {
  try {
    d3Format(format)
    return true
  } catch {
    return false
  }
}

function VisualizationControlsV2(props: Props) {
  const onChangeXAxisGroupFunction = useCallback(
    (groupFunction: string | null) => {
      if (groupFunction === null) {
        props.onChangeXAxisGroupFunction(null)
        return
      }

      const timeUnit = TimeUnit.safeParse(groupFunction)
      if (timeUnit.success) {
        props.onChangeXAxisGroupFunction(timeUnit.data)
        return
      }
    },
    [props.onChangeXAxisGroupFunction]
  )

  const onChangeXAxisSort = useCallback(
    (sort: string | null) => {
      if (sort === 'ascending' || sort === 'descending') {
        props.onChangeXAxisSort(sort)
      } else {
        props.onChangeXAxisSort('ascending')
      }
    },
    [props.onChangeXAxisSort]
  )

  const onChangeHistogramFormat = useCallback(
    (format: string | null) => {
      const parsed = HistogramFormat.safeParse(format)
      if (parsed.success) {
        props.onChangeHistogramFormat(parsed.data)
      }
    },
    [props.onChangeHistogramFormat]
  )

  const onChangeHistogramBin = useCallback(
    (bin: string | null) => {
      if (bin === 'auto') {
        props.onChangeHistogramBin({ type: 'auto' })
        return
      }

      if (bin === 'stepSize') {
        props.onChangeHistogramBin({ type: 'stepSize', value: 1 })
        return
      }

      if (bin === 'maxBins') {
        props.onChangeHistogramBin({ type: 'maxBins', value: 10 })
        return
      }
    },
    [props.onChangeHistogramBin]
  )

  const [binText, setBinText] = useResettableState<string>(
    () => (props.histogramBin.type === 'maxBins' ? '10' : '1'),
    [props.histogramBin.type]
  )
  const onChangeBinText: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (e) => {
        setBinText(e.target.value)
      },
      [setBinText]
    )

  useEffect(() => {
    if (props.histogramBin.type === 'auto') {
      return
    }

    if (props.histogramBin.type === 'stepSize') {
      const value = parseFloat(binText)
      if (Number.isNaN(value) || value <= 0) {
        return
      }

      props.onChangeHistogramBin({ type: 'stepSize', value })
      return
    }

    if (props.histogramBin.type === 'maxBins') {
      const value = Number(binText)
      if (Number.isNaN(value) || !Number.isInteger(value) || value < 2) {
        return
      }

      props.onChangeHistogramBin({ type: 'maxBins', value })
      return
    }
  }, [props.histogramBin.type, binText, props.onChangeHistogramBin])

  const binError = useMemo(() => {
    if (props.histogramBin.type === 'auto') {
      return null
    }

    if (props.histogramBin.type === 'stepSize') {
      const value = parseFloat(binText)
      if (isNaN(value) || value <= 0) {
        return 'Must be a positive number.'
      }

      return null
    }

    if (props.histogramBin.type === 'maxBins') {
      const value = Number(binText)
      if (Number.isNaN(value) || !Number.isInteger(value)) {
        return 'Must be an integer.'
      }

      if (value < 2) {
        return 'Must be at least 2.'
      }

      return null
    }
  }, [props.histogramBin.type, binText])

  const onChangeXAxisName = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        props.onChangeXAxisName(null)
        return
      }
      props.onChangeXAxisName(e.target.value)
    },
    [props.onChangeXAxisName]
  )

  const onChangeYAxisName = useCallback(
    (
      e: React.ChangeEvent<HTMLInputElement>,
      axisIndex: number,
      seriesIndex: number
    ) => {
      if (props.yAxes.length === 0) {
        return
      }

      const name = e.target.value === '' ? null : e.target.value

      const targetAxis = props.yAxes[axisIndex]
      targetAxis.series[seriesIndex].axisName = name

      props.onChangeYAxes(
        props.yAxes.map((y, i) => (i === axisIndex ? targetAxis : y))
      )
    },
    [props.yAxes, props.onChangeYAxes]
  )

  const onChangeNumberValuesFormat = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        props.onChangeNumberValuesFormat(null)
        return
      }
      props.onChangeNumberValuesFormat(e.target.value)
    },
    [props.onChangeNumberValuesFormat]
  )

  const [tab, setTab] = useState<Tab>('general')

  const onChangeYAxis = useCallback(
    (yAxis: YAxisV2, index: number) => {
      props.onChangeYAxes(props.yAxes.map((y, i) => (i === index ? yAxis : y)))
    },
    [props.yAxes, props.onChangeYAxes]
  )

  const onRemoveYAxis = useCallback(
    (index: number) => {
      const newAxes = props.yAxes.slice()
      newAxes.splice(index, 1)
      props.onChangeYAxes(newAxes)
    },
    [props.yAxes, props.onChangeYAxes]
  )

  const onAddYAxis = useCallback(() => {
    props.onChangeYAxes([
      ...props.yAxes,
      {
        series: [
          {
            axisName: null,
            column: null,
            aggregateFunction: null,
            groupBy: null,
            chartType: null,
          },
        ],
      },
    ])
  }, [props.yAxes, props.onChangeYAxes])

  const onChangeChartType = useCallback(
    (chartType: ChartType) => {
      // if only one y-axis is present, reset the chart type of the series
      if (props.yAxes.length === 1) {
        props.onChangeYAxes([
          {
            ...props.yAxes[0],
            series: props.yAxes[0].series.map((s) => ({
              ...s,
              chartType: null,
            })),
          },
        ])
      }

      props.onChangeChartType(chartType)
    },
    [props.onChangeChartType, props.yAxes]
  )

  const defaultXAxisColumn: DataFrameColumn | null = useMemo(() => {
    switch (props.chartType) {
      case 'trend':
      case 'number':
        return null
      case 'histogram':
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
                DataFrameDateColumn.safeParse(a).success ===
                DataFrameDateColumn.safeParse(b).success
                  ? 0
                  : DataFrameDateColumn.safeParse(a).success
                  ? -1
                  : 1,
              (a, b) =>
                DataFrameStringColumn.safeParse(a).success ===
                DataFrameStringColumn.safeParse(b).success
                  ? 0
                  : DataFrameStringColumn.safeParse(a).success
                  ? -1
                  : 1,
              (a, b) =>
                DataFrameNumberColumn.safeParse(a).success ===
                DataFrameNumberColumn.safeParse(b).success
                  ? 0
                  : DataFrameNumberColumn.safeParse(a).success
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
            props.dataframe?.columns ?? []
          )[0] ?? null
        )
    }
  }, [props.chartType, props.dataframe?.columns])

  const axisNameComponents = props.yAxes.map((yAxis, yI) =>
    yAxis.series.map((_, sI) => {
      return (
        <div>
          <label
            htmlFor={`rightYAxisName-${yI}-${sI}`}
            className="block text-xs font-medium leading-6 text-gray-900 pb-1"
          >
            {yI === 0 ? 'Primary' : 'Secondary'} Y-Axis Title
            {sI > 0 ? ` (Series ${sI + 1})` : ''}
          </label>
          <input
            name={`rightYAxisName-${yI}-${sI}`}
            type="text"
            placeholder="My Y-Axis"
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
            value={props.yAxes[yI]?.series[sI]?.axisName ?? ''}
            onChange={(e) => onChangeYAxisName(e, yI, sI)}
            disabled={!props.dataframe || !props.isEditable}
          />
        </div>
      )
    })
  )

  return (
    <ScrollBar
      className={clsx(
        'h-full relative shadow-[2px_0_5px_-4px_#888] overflow-y-auto',
        props.isHidden ? 'w-0' : 'w-1/3 border-r border-gray-200'
      )}
    >
      <VisualizationSettingsTabsV2 tab={tab} onChange={setTab} />
      <div
        className={clsx(
          'flex flex-col items-center',
          props.isHidden ? 'hidden' : 'block'
        )}
      >
        <div className="w-full h-full px-4 py-5">
          {tab === 'general' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              {props.yAxes.length > 1 ||
              props.yAxes.some((y) => y.series.length > 1) ? null : (
                <div>
                  <ChartTypeSelector
                    label="Chart Type"
                    value={props.chartType}
                    onChange={onChangeChartType}
                    isEditable={props.isEditable}
                  />
                </div>
              )}

              <div>
                <AxisSelector
                  label={
                    props.chartType === 'trend' ||
                    props.chartType === 'number' ? (
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
                              If provided, this column will be used to sort the
                              data before picking the number.
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
                  value={props.xAxis}
                  columns={[
                    ...(props.chartType === 'number' ||
                    props.chartType === 'trend'
                      ? [null]
                      : []),
                    ...(props.dataframe?.columns ?? []).filter((c) =>
                      props.chartType === 'histogram'
                        ? NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(
                            c.type
                          ).success
                        : props.chartType === 'number' ||
                          props.chartType === 'trend'
                        ? NumpyDateTypes.safeParse(c.type).success
                        : true
                    ),
                  ]}
                  onChange={props.onChangeXAxis}
                  disabled={!props.dataframe || !props.isEditable}
                  defaultValue={defaultXAxisColumn}
                />
                <div className="flex flex-col gap-y-1 pt-1 px-0.5">
                  {props.xAxis &&
                    props.chartType !== 'histogram' &&
                    NumpyDateTypes.safeParse(props.xAxis.type).success && (
                      <AxisModifierSelector
                        label={
                          props.chartType === 'trend'
                            ? 'Compare by'
                            : 'Group by'
                        }
                        value={props.xAxisGroupFunction}
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
                        onChange={onChangeXAxisGroupFunction}
                        disabled={!props.dataframe || !props.isEditable}
                      />
                    )}
                  {props.chartType === 'histogram' ? (
                    <>
                      <AxisModifierSelector
                        label="Format"
                        value={props.histogramFormat}
                        options={[
                          { name: 'Count', value: 'count' },
                          { name: 'Percentage', value: 'percentage' },
                        ]}
                        onChange={onChangeHistogramFormat}
                        disabled={!props.dataframe || !props.isEditable}
                      />
                      <AxisModifierSelector
                        label="Bin by"
                        value={props.histogramBin.type}
                        options={[
                          { name: 'Auto', value: 'auto' },
                          { name: 'Step size', value: 'stepSize' },
                          { name: 'Max bins', value: 'maxBins' },
                        ]}
                        onChange={onChangeHistogramBin}
                        disabled={!props.dataframe || !props.isEditable}
                      />
                      {props.histogramBin.type !== 'auto' && (
                        <div>
                          <div className="flex items-center gap-x-1">
                            <label
                              htmlFor="histogramBin"
                              className="text-xs text-gray-500 flex-1"
                            >
                              {props.histogramBin.type === 'stepSize'
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
                              disabled={!props.dataframe || !props.isEditable}
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
                      label={
                        props.chartType === 'number' ? 'Choosen value' : 'Sort'
                      }
                      value={props.xAxisSort}
                      options={[
                        {
                          name:
                            props.chartType === 'number' ? 'Last' : 'Ascending',
                          value: 'ascending',
                        },
                        {
                          name:
                            props.chartType === 'number'
                              ? 'First'
                              : 'Descending',
                          value: 'descending',
                        },
                      ]}
                      onChange={onChangeXAxisSort}
                      disabled={!props.dataframe || !props.isEditable}
                    />
                  )}
                </div>
              </div>
              {props.chartType !== 'histogram' && (
                <div className="flex flex-col space-y-6">
                  {props.yAxes
                    .slice(
                      0,
                      props.chartType === 'trend' ||
                        props.chartType === 'number'
                        ? 1
                        : undefined
                    )
                    .map((yAxis, i) => (
                      <YAxisPickerV2
                        yAxis={yAxis}
                        index={i}
                        key={i}
                        onChange={onChangeYAxis}
                        isEditable={props.isEditable}
                        dataframe={props.dataframe}
                        onRemove={i === 1 ? onRemoveYAxis : undefined}
                        onAddYAxis={
                          i === 0 &&
                          props.yAxes.length === 1 &&
                          props.chartType !== 'trend' &&
                          props.chartType !== 'number'
                            ? onAddYAxis
                            : undefined
                        }
                        defaultChartType={props.chartType}
                      />
                    ))}
                </div>
              )}
            </div>
          )}
          {tab === 'x-axis' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              <div>
                <label
                  htmlFor="xAxisName"
                  className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                >
                  X-Axis Name
                </label>
                <input
                  name="xAxisName"
                  type="text"
                  placeholder="My X-Axis"
                  className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                  value={props.xAxisName ?? ''}
                  onChange={onChangeXAxisName}
                  disabled={!props.dataframe || !props.isEditable}
                />
              </div>
            </div>
          )}
          {tab === 'y-axis' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              {axisNameComponents}
            </div>
          )}
          {tab === 'labels' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              <div>
                <VisualizationToggleV2
                  label="Show labels"
                  enabled={props.showDataLabels}
                  onToggle={props.onChangeShowDataLabels}
                />
              </div>
              <div>
                <div className="flex justify-between items-center pb-1">
                  <label
                    htmlFor="numberValuesFormat"
                    className="block text-xs font-medium leading-6 text-gray-900"
                  >
                    Number values format
                  </label>
                  <div className="flex items-center group relative">
                    <PortalTooltip
                      content={
                        <div className="font-sans text-white text-xs rounded-md w-72 -translate-x-1/2">
                          <div className="bg-hunter-950 p-2 rounded-md">
                            <span className="text-gray-400 text-center">
                              This fields accepts{' '}
                              <a
                                href="https://d3js.org/d3-format#locale_format"
                                target="_blank"
                                className="underline"
                                rel="noreferrer"
                              >
                                D3 format strings
                              </a>
                              . For example, use{' '}
                              <span className="font-mono">%</span> to format the
                              numbers as percentage or{' '}
                              <span className="font-mono">$.2f</span> to format
                              the numbers as currency with two decimal places.
                            </span>
                          </div>
                        </div>
                      }
                    >
                      <QuestionMarkCircleIcon
                        className="h-4 w-4 text-gray-300"
                        aria-hidden="true"
                      />
                    </PortalTooltip>
                  </div>
                </div>
                <input
                  name="numberValuesFormat"
                  type="text"
                  className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                  value={props.numberValuesFormat ?? ''}
                  onChange={onChangeNumberValuesFormat}
                  placeholder="$.2f"
                  disabled={!props.dataframe || !props.isEditable}
                />
                {props.numberValuesFormat &&
                  !isValidD3Format(props.numberValuesFormat ?? '') && (
                    <div className="text-red-600 text-xs pt-1">
                      <span>Invalid format string</span>
                    </div>
                  )}
              </div>
            </div>
          )}
        </div>
      </div>
    </ScrollBar>
  )
}

export default VisualizationControlsV2
