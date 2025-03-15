import { ChangeEvent, useCallback } from 'react'
import {
  DataFrame,
  YAxisV2,
  NumpyDateTypes,
  NumpyNumberTypes,
  NumpyTimeDeltaTypes,
} from '@briefer/types'
import { NumberFormatControl, DateFormatControl } from '../FormatControls'

interface YAxisTabProps {
  yAxes: YAxisV2[]
  dataframe: DataFrame | null
  isEditable: boolean
  seriesDecimalPlaces: Record<string, string>
  seriesMultiplier: Record<string, string>
  onChangeYAxisName: (
    e: ChangeEvent<HTMLInputElement>,
    axisIndex: number
  ) => void
  onChangeSeriesDateStyle: (seriesId: string, dateStyle: string | null) => void
  onToggleSeriesShowTime: (seriesId: string) => void
  onChangeSeriesTimeFormat: (
    seriesId: string,
    timeFormat: string | null
  ) => void
  onChangeSeriesNumberStyle: (seriesId: string, style: string | null) => void
  onChangeSeriesSeparatorStyle: (
    seriesId: string,
    separatorStyle: string | null
  ) => void
  onChangeSeriesDecimalPlaces: (seriesId: string, inputValue: string) => void
  onSeriesDecimalPlacesBlur: (seriesId: string, inputValue: string) => void
  onChangeSeriesMultiplier: (seriesId: string, inputValue: string) => void
  onSeriesMultiplierBlur: (seriesId: string, inputValue: string) => void
  onChangeSeriesPrefix: (seriesId: string, value: string) => void
  onChangeSeriesSuffix: (seriesId: string, value: string) => void
}

// Extract a component for each Y-axis section
interface YAxisSectionProps {
  yAxis: YAxisV2
  axisIndex: number
  dataframe: DataFrame | null
  isEditable: boolean
  seriesDecimalPlaces: Record<string, string>
  seriesMultiplier: Record<string, string>
  onChangeYAxisName: (
    e: ChangeEvent<HTMLInputElement>,
    axisIndex: number
  ) => void
  onChangeSeriesDateStyle: (seriesId: string, dateStyle: string | null) => void
  onToggleSeriesShowTime: (seriesId: string) => void
  onChangeSeriesTimeFormat: (
    seriesId: string,
    timeFormat: string | null
  ) => void
  onChangeSeriesNumberStyle: (seriesId: string, style: string | null) => void
  onChangeSeriesSeparatorStyle: (
    seriesId: string,
    separatorStyle: string | null
  ) => void
  onChangeSeriesDecimalPlaces: (seriesId: string, inputValue: string) => void
  onSeriesDecimalPlacesBlur: (seriesId: string, inputValue: string) => void
  onChangeSeriesMultiplier: (seriesId: string, inputValue: string) => void
  onSeriesMultiplierBlur: (seriesId: string, inputValue: string) => void
  onChangeSeriesPrefix: (seriesId: string, value: string) => void
  onChangeSeriesSuffix: (seriesId: string, value: string) => void
}

const YAxisSection = ({
  yAxis,
  axisIndex,
  dataframe,
  isEditable,
  seriesDecimalPlaces,
  seriesMultiplier,
  onChangeYAxisName,
  onChangeSeriesDateStyle,
  onToggleSeriesShowTime,
  onChangeSeriesTimeFormat,
  onChangeSeriesNumberStyle,
  onChangeSeriesSeparatorStyle,
  onChangeSeriesDecimalPlaces,
  onSeriesDecimalPlacesBlur,
  onChangeSeriesMultiplier,
  onSeriesMultiplierBlur,
  onChangeSeriesPrefix,
  onChangeSeriesSuffix,
}: YAxisSectionProps) => {
  const isNumberSeries = (series: YAxisV2['series'][number]) =>
    series.column &&
    NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(series.column.type)
      .success

  const isDateSeries = (series: YAxisV2['series'][number]) =>
    series.column && NumpyDateTypes.safeParse(series.column.type).success

  // Adapter function for series handlers that need to match the shared component interface
  const handleDateStyle = useCallback(
    (seriesId: string | undefined, style: string | null) => {
      if (seriesId) onChangeSeriesDateStyle(seriesId, style)
    },
    [onChangeSeriesDateStyle]
  )

  const handleToggleShowTime = useCallback(
    (seriesId: string | undefined) => {
      if (seriesId) onToggleSeriesShowTime(seriesId)
    },
    [onToggleSeriesShowTime]
  )

  const handleTimeFormat = useCallback(
    (seriesId: string | undefined, format: string | null) => {
      if (seriesId) onChangeSeriesTimeFormat(seriesId, format)
    },
    [onChangeSeriesTimeFormat]
  )

  const handleNumberStyle = useCallback(
    (seriesId: string | undefined, style: string | null) => {
      if (seriesId) onChangeSeriesNumberStyle(seriesId, style)
    },
    [onChangeSeriesNumberStyle]
  )

  const handleSeparatorStyle = useCallback(
    (seriesId: string | undefined, style: string | null) => {
      if (seriesId) onChangeSeriesSeparatorStyle(seriesId, style)
    },
    [onChangeSeriesSeparatorStyle]
  )

  const handleDecimalPlaces = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onChangeSeriesDecimalPlaces(seriesId, value)
    },
    [onChangeSeriesDecimalPlaces]
  )

  const handleDecimalPlacesBlur = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onSeriesDecimalPlacesBlur(seriesId, value)
    },
    [onSeriesDecimalPlacesBlur]
  )

  const handleMultiplier = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onChangeSeriesMultiplier(seriesId, value)
    },
    [onChangeSeriesMultiplier]
  )

  const handleMultiplierBlur = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onSeriesMultiplierBlur(seriesId, value)
    },
    [onSeriesMultiplierBlur]
  )

  const handlePrefix = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onChangeSeriesPrefix(seriesId, value)
    },
    [onChangeSeriesPrefix]
  )

  const handleSuffix = useCallback(
    (seriesId: string | undefined, value: string) => {
      if (seriesId) onChangeSeriesSuffix(seriesId, value)
    },
    [onChangeSeriesSuffix]
  )

  return (
    <div key={yAxis.id} className="mb-8">
      <h2 className="text-sm font-semibold text-gray-900 mb-4">
        {axisIndex === 0 ? 'Left' : 'Right'} Y-Axis
      </h2>

      <div className="mb-6">
        <label
          htmlFor={`yAxisName-${axisIndex}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Axis name
        </label>
        <input
          name={`yAxisName-${axisIndex}`}
          type="text"
          placeholder="My Y-Axis"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={yAxis?.name ?? ''}
          onChange={(e) => onChangeYAxisName(e, axisIndex)}
          disabled={!dataframe || !isEditable}
        />
      </div>

      {yAxis.series.map((series, seriesIndex) => {
        if (!series.column) return null

        const columnName = series.column?.name || ''
        const isDateType = isDateSeries(series)
        const isNumberType = isNumberSeries(series)

        return (
          <div key={series.id} className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-medium">Series {seriesIndex + 1}</h3>
              <span className="text-xs text-gray-500 italic">{columnName}</span>
            </div>

            {isDateType && (
              <DateFormatControl
                currentFormat={series.dateFormat || null}
                dataframe={dataframe}
                isEditable={isEditable}
                seriesId={series.id}
                onChangeDateStyle={handleDateStyle}
                onToggleShowTime={handleToggleShowTime}
                onChangeTimeFormat={handleTimeFormat}
              />
            )}

            {isNumberType && (
              <NumberFormatControl
                initialDecimalPlaces={
                  seriesDecimalPlaces[series.id] ||
                  series.numberFormat?.decimalPlaces?.toString() ||
                  '2'
                }
                initialMultiplier={
                  seriesMultiplier[series.id] ||
                  series.numberFormat?.multiplier?.toString() ||
                  '1'
                }
                currentFormat={series.numberFormat || null}
                dataframe={dataframe}
                isEditable={isEditable}
                seriesId={series.id}
                onChangeNumberStyle={handleNumberStyle}
                onChangeSeparatorStyle={handleSeparatorStyle}
                onChangeDecimalPlaces={handleDecimalPlaces}
                onDecimalPlacesBlur={handleDecimalPlacesBlur}
                onChangeMultiplier={handleMultiplier}
                onMultiplierBlur={handleMultiplierBlur}
                onChangePrefix={handlePrefix}
                onChangeSuffix={handleSuffix}
              />
            )}

            {/* No formatting options - show for columns that are neither date nor number */}
            {!isDateType && !isNumberType && (
              <div className="text-center py-4">
                <p className="text-gray-500">
                  No formatting options are available for this column type.
                </p>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

const YAxisTab = ({
  yAxes,
  dataframe,
  isEditable,
  seriesDecimalPlaces,
  seriesMultiplier,
  onChangeYAxisName,
  onChangeSeriesDateStyle,
  onToggleSeriesShowTime,
  onChangeSeriesTimeFormat,
  onChangeSeriesNumberStyle,
  onChangeSeriesSeparatorStyle,
  onChangeSeriesDecimalPlaces,
  onSeriesDecimalPlacesBlur,
  onChangeSeriesMultiplier,
  onSeriesMultiplierBlur,
  onChangeSeriesPrefix,
  onChangeSeriesSuffix,
}: YAxisTabProps) => {
  return (
    <div className="text-xs text-gray-500">
      {yAxes.map((yAxis, axisIndex) => (
        <YAxisSection
          key={yAxis.id}
          yAxis={yAxis}
          axisIndex={axisIndex}
          dataframe={dataframe}
          isEditable={isEditable}
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
      ))}
    </div>
  )
}

export default YAxisTab
