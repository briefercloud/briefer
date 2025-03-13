import { v4 as uuidv4 } from 'uuid'
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
  DataFrameDateColumn,
  DataFrameStringColumn,
  DataFrameNumberColumn,
  YAxisV2,
  SeriesV2,
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
import { sortWith } from 'ramda'
import ScrollBar from '@/components/ScrollBar'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  NUMBER_SEPARATOR_OPTIONS,
} from '@briefer/editor'
import DisplayControls from './display/DisplayControls'

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
  xAxisDateFormat: VisualizationV2BlockInput['xAxisDateFormat']
  onChangeXAxisDateFormat: (
    dateFormat: NonNullable<VisualizationV2BlockInput['xAxisDateFormat']>
  ) => void
  xAxisNumberFormat: VisualizationV2BlockInput['xAxisNumberFormat']
  onChangeXAxisNumberFormat: (
    format: VisualizationV2BlockInput['xAxisNumberFormat']
  ) => void
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
  onChangeSeries: (id: SeriesV2['id'], series: SeriesV2) => void
  onChangeAllSeries: (yIndex: number, series: SeriesV2[]) => void
  result: VisualizationV2BlockOutputResult | null
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

  const [tab, setTab] = useState<Tab>('general')

  // State variables to track raw input strings for number formatting
  const [decimalPlacesInput, setDecimalPlacesInput] = useState<string>(
    () => props.xAxisNumberFormat?.decimalPlaces?.toString() || '2'
  )
  const [multiplierInput, setMultiplierInput] = useState<string>(
    () => props.xAxisNumberFormat?.multiplier?.toString() || '1'
  )

  // Update the input strings when the actual values change (e.g. from outside)
  useEffect(() => {
    setDecimalPlacesInput(
      props.xAxisNumberFormat?.decimalPlaces?.toString() || '2'
    )
  }, [props.xAxisNumberFormat?.decimalPlaces])

  useEffect(() => {
    setMultiplierInput(props.xAxisNumberFormat?.multiplier?.toString() || '1')
  }, [props.xAxisNumberFormat?.multiplier])

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
        id: uuidv4(),
        name: null,
        series: [
          {
            id: uuidv4(),
            column: null,
            aggregateFunction: 'sum',
            groupBy: null,
            chartType: null,
            name: null,
            color: null,
            groups: null,
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

  // Handler for date format changes
  const onChangeDateStyle = useCallback(
    (dateStyle: string | null) => {
      if (!dateStyle) return

      if (props.xAxisDateFormat) {
        props.onChangeXAxisDateFormat({
          ...props.xAxisDateFormat,
          dateStyle: dateStyle as any,
        })
      } else {
        props.onChangeXAxisDateFormat({
          dateStyle: dateStyle as any,
          showTime: false,
          timeFormat: 'h:mm a',
        })
      }
    },
    [props.xAxisDateFormat, props.onChangeXAxisDateFormat]
  )

  // Handler for toggling time display
  const onToggleShowTime = useCallback(() => {
    if (props.xAxisDateFormat) {
      props.onChangeXAxisDateFormat({
        ...props.xAxisDateFormat,
        showTime: !props.xAxisDateFormat.showTime,
      })
    } else {
      props.onChangeXAxisDateFormat({
        dateStyle: 'MMMM d, yyyy',
        showTime: true,
        timeFormat: 'h:mm a',
      })
    }
  }, [props.xAxisDateFormat, props.onChangeXAxisDateFormat])

  // Handler for time format changes
  const onChangeTimeFormat = useCallback(
    (timeFormat: string | null) => {
      if (!timeFormat || !props.xAxisDateFormat) return

      props.onChangeXAxisDateFormat({
        ...props.xAxisDateFormat,
        timeFormat: timeFormat as any,
      })
    },
    [props.xAxisDateFormat, props.onChangeXAxisDateFormat]
  )

  // Handler for number format style changes
  const onChangeNumberStyle = useCallback(
    (style: string | null) => {
      if (!style) return

      if (props.xAxisNumberFormat) {
        props.onChangeXAxisNumberFormat({
          ...props.xAxisNumberFormat,
          style: style as 'normal' | 'percent' | 'scientific',
        })
      } else {
        props.onChangeXAxisNumberFormat({
          style: style as 'normal' | 'percent' | 'scientific',
          separatorStyle: '999,999.99',
          decimalPlaces: 2,
          multiplier: 1,
          prefix: null,
          suffix: null,
        })
      }
    },
    [props.xAxisNumberFormat, props.onChangeXAxisNumberFormat]
  )

  // Handler for separator style changes
  const onChangeSeparatorStyle = useCallback(
    (separatorStyle: string | null) => {
      if (!separatorStyle) return

      if (props.xAxisNumberFormat) {
        props.onChangeXAxisNumberFormat({
          ...props.xAxisNumberFormat,
          separatorStyle: separatorStyle as
            | '999,999.99'
            | '999.999,99'
            | '999 999,99'
            | "999'999.99"
            | '999999.99',
        })
      } else {
        props.onChangeXAxisNumberFormat({
          style: 'normal',
          separatorStyle: separatorStyle as
            | '999,999.99'
            | '999.999,99'
            | '999 999,99'
            | "999'999.99"
            | '999999.99',
          decimalPlaces: 2,
          multiplier: 1,
          prefix: null,
          suffix: null,
        })
      }
    },
    [props.xAxisNumberFormat, props.onChangeXAxisNumberFormat]
  )

  // Shared function to update number format settings
  const updateNumberFormat = useCallback(
    (
      updates: Partial<
        NonNullable<VisualizationV2BlockInput['xAxisNumberFormat']>
      >
    ) => {
      if (props.xAxisNumberFormat) {
        props.onChangeXAxisNumberFormat({
          ...props.xAxisNumberFormat,
          ...updates,
        })
      } else {
        props.onChangeXAxisNumberFormat({
          style: 'normal',
          separatorStyle: '999,999.99',
          decimalPlaces: 2,
          multiplier: 1,
          prefix: null,
          suffix: null,
          ...updates,
        })
      }
    },
    [props.xAxisNumberFormat, props.onChangeXAxisNumberFormat]
  )

  // Parse decimal places input and return validity + value
  const parseDecimalPlaces = (input: string) => {
    const cleanedValue = input.replace(/[^\d]/g, '')
    const isValid = cleanedValue !== '' && !isNaN(parseInt(cleanedValue, 10))
    const numValue = isValid ? parseInt(cleanedValue, 10) : 0
    return { isValid, numValue, cleanedValue }
  }

  // Handler for decimal places changes
  const onChangeDecimalPlaces = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setDecimalPlacesInput(inputValue)

      // Only apply valid values in real-time
      const { isValid, numValue } = parseDecimalPlaces(inputValue)
      if (isValid) {
        updateNumberFormat({ decimalPlaces: numValue })
      }
    },
    [updateNumberFormat]
  )

  // Handler for decimal places blur
  const onDecimalPlacesBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const { isValid, numValue } = parseDecimalPlaces(inputValue)

      // Only update if the current value is invalid
      if (!isValid) {
        setDecimalPlacesInput(numValue.toString())
        updateNumberFormat({ decimalPlaces: numValue })
      }
    },
    [updateNumberFormat]
  )

  // Parse multiplier input and return validity + value
  const parseMultiplier = (input: string) => {
    const cleanedValue = input.replace(/[^\d.]/g, '')
    const isValid = cleanedValue !== '' && !isNaN(parseFloat(cleanedValue))
    const numValue = isValid ? parseFloat(cleanedValue) : 1
    return { isValid, numValue, cleanedValue }
  }

  // Handler for multiplier changes
  const onChangeMultiplier = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setMultiplierInput(inputValue)

      // Only apply valid values in real-time
      const { isValid, numValue } = parseMultiplier(inputValue)
      if (isValid) {
        updateNumberFormat({ multiplier: numValue })
      }
    },
    [updateNumberFormat]
  )

  // Handler for multiplier blur
  const onMultiplierBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const { isValid, numValue } = parseMultiplier(inputValue)

      // Only update if the current value is invalid
      if (!isValid) {
        setMultiplierInput(numValue.toString())
        updateNumberFormat({ multiplier: numValue })
      }
    },
    [updateNumberFormat]
  )

  // Update prefix and suffix handlers to use the shared updateNumberFormat function
  const onChangePrefix = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === '' ? null : e.target.value
      updateNumberFormat({ prefix: value })
    },
    [updateNumberFormat]
  )

  const onChangeSuffix = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === '' ? null : e.target.value
      updateNumberFormat({ suffix: value })
    },
    [updateNumberFormat]
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
            <DisplayControls
              yAxes={props.yAxes}
              dataframe={props.dataframe}
              isEditable={props.isEditable}
              result={props.result}
              onChangeSeries={props.onChangeSeries}
              onChangeAllSeries={props.onChangeAllSeries}
            />
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

              {/* Date formatting options - only show for date columns */}
              {props.xAxis &&
                NumpyDateTypes.safeParse(props.xAxis.type).success && (
                  <>
                    <div className="border-t border-gray-200 pt-5">
                      {/* Date style dropdown */}
                      <AxisModifierSelector
                        label="Date style"
                        value={props.xAxisDateFormat?.dateStyle || null}
                        options={DATE_FORMAT_OPTIONS}
                        onChange={onChangeDateStyle}
                        disabled={!props.dataframe || !props.isEditable}
                      />

                      {/* Show time toggle */}
                      <div className="mt-4">
                        <VisualizationToggleV2
                          label="Show time"
                          enabled={props.xAxisDateFormat?.showTime || false}
                          onToggle={onToggleShowTime}
                        />
                      </div>

                      {/* Time format dropdown - only show when showTime is true */}
                      {props.xAxisDateFormat?.showTime && (
                        <div className="mt-4">
                          <AxisModifierSelector
                            label="Time format"
                            value={props.xAxisDateFormat?.timeFormat || null}
                            options={TIME_FORMAT_OPTIONS}
                            onChange={onChangeTimeFormat}
                            disabled={!props.dataframe || !props.isEditable}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}

              {/* Number formatting options - only show for number columns */}
              {props.xAxis &&
                NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(
                  props.xAxis.type
                ).success && (
                  <>
                    <div className="border-t border-gray-200 pt-5">
                      <h3 className="text-xs font-medium pb-4">
                        Number format
                      </h3>

                      {/* Style selector */}
                      <AxisModifierSelector
                        label="Style"
                        value={props.xAxisNumberFormat?.style || 'normal'}
                        options={NUMBER_STYLE_OPTIONS}
                        onChange={onChangeNumberStyle}
                        disabled={!props.dataframe || !props.isEditable}
                      />

                      {/* Separator style selector */}
                      <div className="mt-4">
                        <AxisModifierSelector
                          label="Separator style"
                          value={
                            props.xAxisNumberFormat?.separatorStyle ||
                            '999,999.99'
                          }
                          options={NUMBER_SEPARATOR_OPTIONS}
                          onChange={onChangeSeparatorStyle}
                          disabled={!props.dataframe || !props.isEditable}
                        />
                      </div>

                      {/* Decimal places input */}
                      <div className="mt-4">
                        <label
                          htmlFor="decimalPlaces"
                          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                        >
                          Number of decimal places
                        </label>
                        <input
                          name="decimalPlaces"
                          type="text"
                          min="0"
                          max="10"
                          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                          value={decimalPlacesInput}
                          onChange={onChangeDecimalPlaces}
                          onBlur={onDecimalPlacesBlur}
                          disabled={!props.dataframe || !props.isEditable}
                        />
                      </div>

                      {/* Multiplier input */}
                      <div className="mt-4">
                        <label
                          htmlFor="multiplier"
                          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                        >
                          Multiply by a number
                        </label>
                        <input
                          name="multiplier"
                          type="text"
                          step="any"
                          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                          value={multiplierInput}
                          onChange={onChangeMultiplier}
                          onBlur={onMultiplierBlur}
                          disabled={!props.dataframe || !props.isEditable}
                        />
                      </div>

                      {/* Prefix input */}
                      <div className="mt-4">
                        <label
                          htmlFor="prefix"
                          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                        >
                          Add a prefix
                        </label>
                        <input
                          name="prefix"
                          type="text"
                          placeholder="$"
                          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                          value={props.xAxisNumberFormat?.prefix ?? ''}
                          onChange={onChangePrefix}
                          disabled={!props.dataframe || !props.isEditable}
                        />
                      </div>

                      {/* Suffix input */}
                      <div className="mt-4">
                        <label
                          htmlFor="suffix"
                          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
                        >
                          Add a suffix
                        </label>
                        <input
                          name="suffix"
                          type="text"
                          placeholder="dollars"
                          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
                          value={props.xAxisNumberFormat?.suffix ?? ''}
                          onChange={onChangeSuffix}
                          disabled={!props.dataframe || !props.isEditable}
                        />
                      </div>
                    </div>
                  </>
                )}
            </div>
          )}
          {tab === 'y-axis' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              {axisNameComponents}
            </div>
          )}
          {tab === 'labels' && (
            <div className="text-xs text-gray-500 flex flex-col space-y-8">
              <div className="flex flex-col gap-y-3">
                <VisualizationToggleV2
                  label="Show labels"
                  enabled={props.dataLabels.show}
                  onToggle={onToggleShowDataLabels}
                />
                {props.dataLabels.show && (
                  <AxisModifierSelector
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
            </div>
          )}
        </div>
      </div>
    </ScrollBar>
  )
}

export default VisualizationControlsV2
