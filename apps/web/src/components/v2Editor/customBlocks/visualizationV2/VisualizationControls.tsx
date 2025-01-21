import ReactDOM from 'react-dom'
import { SketchPicker } from 'react-color'
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
  SeriesV2,
} from '@briefer/types'
import ChartTypeSelector from '@/components/ChartTypeSelector'
import AxisSelector from '@/components/AxisSelector'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import {
  CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import useResettableState from '@/hooks/useResettableState'
import VisualizationSettingsTabsV2, { Tab } from './VisualizationSettingTabs'
import YAxisPickerV2 from './YAxisPicker'
import VisualizationToggleV2 from './VisualizationToggle'
import { PortalTooltip } from '@/components/Tooltips'
import { sortWith, ascend, GT, omit, length } from 'ramda'
import ScrollBar from '@/components/ScrollBar'
import {
  getColorFromSerie,
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'
import useResizeMemo from '@/hooks/useResizeMemo'
import { Transition } from '@headlessui/react'
import {
  useOnClickOutside,
  useOnClickOutside2,
} from '@/hooks/useOnClickOutside'

const presetColors = [
  '#516b91',
  '#59c4e6',
  '#edafda',
  '#93b7e3',
  '#a5e7f0',
  '#cbb0e3',
  '#2a9d8f',
  '#e76f51',
  '#f4a261',
  '#264653',
  '#e9c46a',
  '#ff6f61',
  '#6a4c93',
  '#ffa600',
  '#ffffff',
  '#000000',
]

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
  dataLabels: VisualizationV2BlockInput['dataLabels']
  onChangeDataLabels: (
    dataLabels: VisualizationV2BlockInput['dataLabels']
  ) => void
  isEditable: boolean
  result: VisualizationV2BlockOutputResult | null
  colors: VisualizationV2BlockInput['colors']
  onChangeColors: (colors: VisualizationV2BlockInput['colors']) => void
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
    (e: React.ChangeEvent<HTMLInputElement>, axisIndex: number) => {
      if (props.yAxes.length === 0) {
        return
      }

      const name = e.target.value === '' ? null : e.target.value

      props.onChangeYAxes(
        props.yAxes.map((y, i) => (i === axisIndex ? { ...y, name } : y))
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
        name: null,
        series: [
          {
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
        return (
          props.dataframe?.columns.filter(
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

  const axisNameComponents = useMemo(
    () =>
      props.yAxes.map((yAxis, yI) => (
        <div>
          <label
            htmlFor={`rightYAxisName-${yI}`}
            className="block text-xs font-medium leading-6 text-gray-900 pb-1"
          >
            {yI === 0 ? 'Primary' : 'Secondary'} Y-Axis Title
          </label>
          <input
            name={`rightYAxisName-${yI}`}
            type="text"
            placeholder="My Y-Axis"
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
            value={yAxis?.name ?? ''}
            onChange={(e) => onChangeYAxisName(e, yI)}
            disabled={!props.dataframe || !props.isEditable}
          />
        </div>
      )),
    [props.yAxes, props.dataframe, props.isEditable, onChangeYAxisName]
  )

  const onToggleShowDataLabels = useCallback(() => {
    props.onChangeDataLabels({
      ...props.dataLabels,
      show: !props.dataLabels.show,
    })
  }, [props.dataLabels, props.onChangeDataLabels])

  const onChangeDataLabelsFrequency = useCallback(
    (frequency: string | null) => {
      props.onChangeDataLabels({
        ...props.dataLabels,
        frequency: frequency === 'some' ? 'some' : 'all',
      })
    },
    [props.dataLabels, props.onChangeDataLabels]
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
          {tab === 'display' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              {props.yAxes.map((yAxis, yI) => {
                let prefix = ''
                if (props.yAxes.length > 1) {
                  prefix = yI === 0 ? 'Left ' : 'Right '
                }
                return (
                  <div key={yI}>
                    <div className="text-md font-medium leading-6 text-gray-900 pb-2">
                      {prefix} Y-Axis
                    </div>
                    {yAxis.series.map((s, i) => {
                      if (!s.column) {
                        return null
                      }

                      let groupBySeries: {
                        id: string
                        name: string
                        color: string
                      }[] = []
                      if (s.groupBy) {
                        for (const series of props.result?.series ?? []) {
                          if (series.id.includes(`y-${yI}-series-${i}`)) {
                            let color = props.colors[series.id] ?? ''
                            if (color === '') {
                              color =
                                getColorFromSerie(series) ?? presetColors[0]
                            }

                            groupBySeries.push({
                              id: series.id,
                              name: series.name ?? '',
                              color,
                            })
                          }
                        }
                      }

                      let color = props.colors[`y-${yI}-series-${i}`] ?? ''
                      if (color === '') {
                        const result = props.result?.series.find(
                          (s) => s.id === `y-${yI}-series-${i}`
                        )
                        if (result) {
                          color = getColorFromSerie(result) ?? presetColors[0]
                        } else {
                          color = presetColors[0]
                        }
                      }

                      return (
                        <div key={i} className="pt-1.5">
                          <label
                            className="block text-xs leading-6 text-gray-900 pb-1 flex items-center justify-between"
                            htmlFor={`series-name-${yI}-${i}`}
                          >
                            <span className="font-medium">Column</span>{' '}
                            <span className="font-mono bg-gray-100 text-gray-400 text-xs px-1 py-0.5 rounded-md flex items-center justify-center text-[10px]">
                              {s.column.name.toString()}
                            </span>
                          </label>

                          <div className="flex items-center space-x-1">
                            <div className="w-full relative">
                              <input
                                name={`series-name-${yI}-${i}`}
                                type="text"
                                placeholder={s.column?.name?.toString() ?? ''}
                                className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative"
                                disabled={!props.dataframe || !props.isEditable}
                              />
                              <ColorPicker
                                className="absolute left-1 top-1"
                                id={`y-${yI}-series-${i}`}
                                color={color}
                                colors={props.colors}
                                onChangeColors={props.onChangeColors}
                              />
                            </div>
                          </div>
                          {s.groupBy && (
                            <>
                              <div className="text-xs leading-6 text-gray-900 pt-1.5 flex items-center justify-between">
                                <span className="font-medium">Group By</span>{' '}
                                <span className="font-mono bg-gray-100 text-gray-400 text-xs px-1 py-0.5 rounded-md flex items-center justify-center text-[10px]">
                                  {s.groupBy.name.toString()}
                                </span>
                              </div>
                              <div className="flex flex-col space-y-1">
                                {groupBySeries.map((series, j) => {
                                  return (
                                    <GroupBySeriesDisplay
                                      id={series.id}
                                      name={series.name}
                                      color={series.color}
                                      yIndex={yI}
                                      index={j}
                                      colors={props.colors}
                                      onChangeColors={props.onChangeColors}
                                      dataframe={props.dataframe}
                                      isEditable={props.isEditable}
                                    />
                                  )
                                })}
                              </div>
                            </>
                          )}
                          {i < yAxis.series.length - 1 && (
                            <div className="w-full bg-gray-400 my-4 border-1 border-b border-dashed" />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
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
                  enabled={props.dataLabels.show}
                  onToggle={onToggleShowDataLabels}
                />
                {props.dataLabels.show && (
                  <AxisModifierSelector
                    className="pt-1"
                    label="Labels to show"
                    value={props.dataLabels.frequency}
                    options={[
                      { name: 'All', value: 'all' },
                      { name: 'Some', value: 'some' },
                    ]}
                    onChange={onChangeDataLabelsFrequency}
                    disabled={!props.dataframe || !props.isEditable}
                  />
                )}
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

interface GroupBySeriesDisplayProps {
  id: string
  name: string
  color: string
  yIndex: number
  index: number
  colors: VisualizationV2BlockInput['colors']
  onChangeColors: (colors: VisualizationV2BlockInput['colors']) => void
  dataframe: DataFrame | null
  isEditable: boolean
}
function GroupBySeriesDisplay(props: GroupBySeriesDisplayProps) {
  return (
    <div className="flex items-center space-x-1">
      <div className="relative w-full">
        <input
          name={`groupby-series-name-${props.yIndex}-${props.index}`}
          type="text"
          placeholder={props.name}
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group pr-2.5 pl-10 text-gray-800 text-xs placeholder:text-gray-400 relative"
          disabled={!props.dataframe || !props.isEditable}
        />
        <ColorPicker
          className="absolute left-1 top-1"
          id={props.id}
          color={props.color}
          colors={props.colors}
          onChangeColors={props.onChangeColors}
        />
      </div>
    </div>
  )
}

interface ColorPickerProps {
  id: string
  color: string
  colors: VisualizationV2BlockInput['colors']
  onChangeColors: (colors: VisualizationV2BlockInput['colors']) => void
  className?: string
}
function ColorPicker(props: ColorPickerProps) {
  const onChangeColor = useCallback(
    (color: { hex: string }) => {
      props.onChangeColors({
        ...props.colors,
        [props.id]: color.hex,
      })
    },
    [props.colors, props.id, props.onChangeColors]
  )

  const [pickerOpen, setPickerOpen] = useState(false)
  const onTogglePickerOpen = useCallback(() => {
    setPickerOpen((prev) => !prev)
  }, [])

  const buttonRef = useRef<HTMLButtonElement>(null)

  const dropdownStyle: CSSProperties = useResizeMemo(
    (rect) => ({
      position: 'absolute',
      top: rect?.bottom,
      left: rect?.left ?? 0,
      zIndex: 9001,
    }),
    buttonRef.current
  )

  const pickerContainerRef = useRef<HTMLDivElement>(null)
  useOnClickOutside2(
    () => {
      setPickerOpen(false)
    },
    pickerContainerRef,
    buttonRef,
    pickerOpen
  )
  return (
    <div className={props.className}>
      <button
        className="w-6 h-6 rounded-md border hover:opacity-90 transition-opacity duration-300"
        style={{ backgroundColor: props.color }}
        onClick={onTogglePickerOpen}
        ref={buttonRef}
      />
      {ReactDOM.createPortal(
        <Transition
          className="pt-2"
          show={pickerOpen}
          enter="transition-opacity duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition-opacity duration-300"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
          style={dropdownStyle}
          as="div"
          ref={pickerContainerRef}
        >
          <SketchPicker
            color={props.color}
            onChange={onChangeColor}
            presetColors={presetColors}
          />
        </Transition>,
        document.body
      )}
    </div>
  )
}

export default VisualizationControlsV2
