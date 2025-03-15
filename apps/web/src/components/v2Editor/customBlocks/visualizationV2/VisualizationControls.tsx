import { v4 as uuidv4 } from 'uuid'
import clsx from 'clsx'
import {
  ChartType,
  DataFrame,
  DataFrameColumn,
  TimeUnit,
  HistogramFormat,
  HistogramBin,
  YAxisV2,
  SeriesV2,
  NumberFormat,
} from '@briefer/types'
import { useCallback, useEffect, useState } from 'react'
import VisualizationSettingsTabsV2, { Tab } from './VisualizationSettingTabs'
import ScrollBar from '@/components/ScrollBar'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
  getDefaultDateFormat,
  getDefaultNumberFormat,
} from '@briefer/editor'

// Import the tab components
import GeneralTab from './tabs/GeneralTab'
import XAxisTab from './tabs/XAxisTab'
import YAxisTab from './tabs/YAxisTab'
import LabelsTab from './tabs/LabelsTab'
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
  const [tab, setTab] = useState<Tab>('general')

  // State variables for series number formatting
  const [seriesDecimalPlaces, setSeriesDecimalPlaces] = useState<
    Record<string, string>
  >({})
  const [seriesMultiplier, setSeriesMultiplier] = useState<
    Record<string, string>
  >({})

  // Initialize state values from props on first render
  useEffect(() => {
    const decimalPlacesMap: Record<string, string> = {}
    const multiplierMap: Record<string, string> = {}

    props.yAxes.forEach((yAxis) => {
      yAxis.series.forEach((series) => {
        if (series.numberFormat) {
          decimalPlacesMap[series.id] =
            series.numberFormat.decimalPlaces.toString()
          multiplierMap[series.id] = series.numberFormat.multiplier.toString()
        }
      })
    })

    setSeriesDecimalPlaces(decimalPlacesMap)
    setSeriesMultiplier(multiplierMap)
  }, [])

  // Update input states when series change
  useEffect(() => {
    const decimalPlacesMap = { ...seriesDecimalPlaces }
    const multiplierMap = { ...seriesMultiplier }

    props.yAxes.forEach((yAxis) => {
      yAxis.series.forEach((series) => {
        if (series.numberFormat && !decimalPlacesMap[series.id]) {
          decimalPlacesMap[series.id] =
            series.numberFormat.decimalPlaces.toString()
        }
        if (series.numberFormat && !multiplierMap[series.id]) {
          multiplierMap[series.id] = series.numberFormat.multiplier.toString()
        }
      })
    })

    setSeriesDecimalPlaces(decimalPlacesMap)
    setSeriesMultiplier(multiplierMap)
  }, [props.yAxes, seriesDecimalPlaces, seriesMultiplier])

  // GeneralTab callbacks
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
            dateFormat: getDefaultDateFormat(),
            numberFormat: getDefaultNumberFormat(),
          },
        ],
      },
    ])
  }, [props.yAxes, props.onChangeYAxes])

  // YAxisTab callbacks
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

  // Series formatting helper function
  const updateSeriesNumberFormat = useCallback(
    (seriesId: string, updates: Partial<NumberFormat>) => {
      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series) return

      const updatedSeries = {
        ...series,
        numberFormat: series.numberFormat
          ? { ...series.numberFormat, ...updates }
          : { ...getDefaultNumberFormat(), ...updates },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  // Series date formatting callbacks
  const onChangeSeriesDateStyle = useCallback(
    (seriesId: string, dateStyle: string | null) => {
      if (!dateStyle) return

      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series) return

      const updatedSeries = {
        ...series,
        dateFormat: series.dateFormat
          ? { ...series.dateFormat, dateStyle: dateStyle as any }
          : { ...getDefaultDateFormat(), dateStyle: dateStyle as any },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  const onToggleSeriesShowTime = useCallback(
    (seriesId: string) => {
      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series) return

      const updatedSeries = {
        ...series,
        dateFormat: series.dateFormat
          ? { ...series.dateFormat, showTime: !series.dateFormat.showTime }
          : { ...getDefaultDateFormat(), showTime: true },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  const onChangeSeriesTimeFormat = useCallback(
    (seriesId: string, timeFormat: string | null) => {
      if (!timeFormat) return

      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series || !series.dateFormat) return

      const updatedSeries = {
        ...series,
        dateFormat: {
          ...series.dateFormat,
          timeFormat: timeFormat as any,
        },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  // Series number formatting callbacks
  const onChangeSeriesNumberStyle = useCallback(
    (seriesId: string, style: string | null) => {
      if (!style) return

      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series) return

      const updatedSeries = {
        ...series,
        numberFormat: series.numberFormat
          ? { ...series.numberFormat, style: style as any }
          : { ...getDefaultNumberFormat(), style: style as any },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  const onChangeSeriesSeparatorStyle = useCallback(
    (seriesId: string, separatorStyle: string | null) => {
      if (!separatorStyle) return

      const series = props.yAxes
        .flatMap((axis) => axis.series)
        .find((s) => s.id === seriesId)

      if (!series) return

      const updatedSeries = {
        ...series,
        numberFormat: series.numberFormat
          ? { ...series.numberFormat, separatorStyle: separatorStyle as any }
          : {
              ...getDefaultNumberFormat(),
              separatorStyle: separatorStyle as any,
            },
      }

      props.onChangeSeries(seriesId, updatedSeries)
    },
    [props.yAxes, props.onChangeSeries]
  )

  const onChangeSeriesDecimalPlaces = useCallback(
    (seriesId: string, inputValue: string) => {
      setSeriesDecimalPlaces((prev) => ({ ...prev, [seriesId]: inputValue }))

      const cleanedValue = inputValue.replace(/[^\d]/g, '')
      const isValid = cleanedValue !== '' && !isNaN(parseInt(cleanedValue, 10))

      if (isValid) {
        const numValue = parseInt(cleanedValue, 10)
        updateSeriesNumberFormat(seriesId, { decimalPlaces: numValue })
      }
    },
    [updateSeriesNumberFormat]
  )

  const onSeriesDecimalPlacesBlur = useCallback(
    (seriesId: string, inputValue: string) => {
      const { numValue } = parseDecimalPlaces(inputValue)

      setSeriesDecimalPlaces((prev) => ({
        ...prev,
        [seriesId]: numValue.toString(),
      }))
      updateSeriesNumberFormat(seriesId, { decimalPlaces: numValue })
    },
    [updateSeriesNumberFormat]
  )

  const onChangeSeriesMultiplier = useCallback(
    (seriesId: string, inputValue: string) => {
      setSeriesMultiplier((prev) => ({ ...prev, [seriesId]: inputValue }))

      const { numValue } = parseMultiplier(inputValue)
      updateSeriesNumberFormat(seriesId, { multiplier: numValue })
    },
    [updateSeriesNumberFormat]
  )

  const onSeriesMultiplierBlur = useCallback(
    (seriesId: string, inputValue: string) => {
      const { numValue } = parseMultiplier(inputValue)

      setSeriesMultiplier((prev) => ({
        ...prev,
        [seriesId]: numValue.toString(),
      }))
      updateSeriesNumberFormat(seriesId, { multiplier: numValue })
    },
    [updateSeriesNumberFormat]
  )

  const onChangeSeriesPrefix = useCallback(
    (seriesId: string, value: string) => {
      updateSeriesNumberFormat(seriesId, {
        prefix: value === '' ? null : value,
      })
    },
    [updateSeriesNumberFormat]
  )

  const onChangeSeriesSuffix = useCallback(
    (seriesId: string, value: string) => {
      updateSeriesNumberFormat(seriesId, {
        suffix: value === '' ? null : value,
      })
    },
    [updateSeriesNumberFormat]
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
            <GeneralTab
              dataframe={props.dataframe}
              chartType={props.chartType}
              onChangeChartType={props.onChangeChartType}
              xAxis={props.xAxis}
              onChangeXAxis={props.onChangeXAxis}
              xAxisSort={props.xAxisSort}
              onChangeXAxisSort={props.onChangeXAxisSort}
              xAxisGroupFunction={props.xAxisGroupFunction}
              onChangeXAxisGroupFunction={props.onChangeXAxisGroupFunction}
              histogramFormat={props.histogramFormat}
              onChangeHistogramFormat={props.onChangeHistogramFormat}
              histogramBin={props.histogramBin}
              onChangeHistogramBin={props.onChangeHistogramBin}
              yAxes={props.yAxes}
              onChangeYAxes={props.onChangeYAxes}
              onChangeYAxis={onChangeYAxis}
              onRemoveYAxis={onRemoveYAxis}
              onAddYAxis={onAddYAxis}
              isEditable={props.isEditable}
            />
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
            <XAxisTab
              dataframe={props.dataframe}
              xAxis={props.xAxis}
              xAxisName={props.xAxisName}
              onChangeXAxisName={props.onChangeXAxisName}
              xAxisDateFormat={props.xAxisDateFormat}
              onChangeXAxisDateFormat={props.onChangeXAxisDateFormat}
              xAxisNumberFormat={props.xAxisNumberFormat}
              onChangeXAxisNumberFormat={props.onChangeXAxisNumberFormat}
              isEditable={props.isEditable}
            />
          )}
          {tab === 'y-axis' && (
            <YAxisTab
              yAxes={props.yAxes}
              dataframe={props.dataframe}
              isEditable={props.isEditable}
              seriesDecimalPlaces={seriesDecimalPlaces}
              seriesMultiplier={seriesMultiplier}
              onChangeYAxisName={onChangeYAxisName}
              onChangeSeriesDateStyle={onChangeSeriesDateStyle}
              onToggleSeriesShowTime={onToggleSeriesShowTime}
              onChangeSeriesTimeFormat={onChangeSeriesTimeFormat}
              onChangeSeriesNumberStyle={onChangeSeriesNumberStyle}
              onChangeSeriesSeparatorStyle={onChangeSeriesSeparatorStyle}
              onChangeSeriesDecimalPlaces={onChangeSeriesDecimalPlaces}
              onSeriesDecimalPlacesBlur={onSeriesDecimalPlacesBlur}
              onChangeSeriesMultiplier={onChangeSeriesMultiplier}
              onSeriesMultiplierBlur={onSeriesMultiplierBlur}
              onChangeSeriesPrefix={onChangeSeriesPrefix}
              onChangeSeriesSuffix={onChangeSeriesSuffix}
            />
          )}
          {tab === 'labels' && (
            <LabelsTab
              dataframe={props.dataframe}
              isEditable={props.isEditable}
              dataLabels={props.dataLabels}
              onChangeDataLabels={props.onChangeDataLabels}
            />
          )}
        </div>
      </div>
    </ScrollBar>
  )
}

/**
 * Parse decimal places input and return validity + value
 * @param input The string input to parse
 * @returns Object containing validation results and parsed value
 */
export const parseDecimalPlaces = (input: string) => {
  const cleanedValue = input.replace(/[^\d]/g, '')
  let numValue = parseInt(cleanedValue, 10)
  if (Number.isNaN(numValue)) {
    numValue = 2
  }
  return { numValue, cleanedValue }
}

/**
 * Parse multiplier input and return validity + value
 * @param input The string input to parse
 * @returns Object containing validation results and parsed value
 */
export const parseMultiplier = (input: string) => {
  const cleanedValue = input.replace(/[^\d.]/g, '')
  let numValue = parseFloat(cleanedValue)
  if (Number.isNaN(numValue)) {
    numValue = 1
  }
  return { numValue, cleanedValue }
}

export default VisualizationControlsV2
