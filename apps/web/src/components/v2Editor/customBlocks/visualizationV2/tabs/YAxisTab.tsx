import {
  ChangeEvent,
  useMemo,
  useState,
  useCallback,
  FocusEvent,
  useEffect,
} from 'react'
import {
  DataFrame,
  YAxisV2,
  NumpyDateTypes,
  NumpyNumberTypes,
  NumpyTimeDeltaTypes,
} from '@briefer/types'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import VisualizationToggleV2 from '../VisualizationToggle'
import { parseDecimalPlaces, parseMultiplier } from '../VisualizationControls'
import {
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  NUMBER_SEPARATOR_OPTIONS,
} from '@briefer/editor'

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

// Component to handle number formatting with local state
interface SeriesNumberFormatControlProps {
  series: YAxisV2['series'][number]
  isEditable: boolean
  dataframe: DataFrame | null
  initialDecimalPlaces: string
  initialMultiplier: string
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

const SeriesNumberFormatControl = ({
  series,
  isEditable,
  dataframe,
  initialDecimalPlaces,
  initialMultiplier,
  onChangeSeriesNumberStyle,
  onChangeSeriesSeparatorStyle,
  onChangeSeriesDecimalPlaces,
  onSeriesDecimalPlacesBlur,
  onChangeSeriesMultiplier,
  onSeriesMultiplierBlur,
  onChangeSeriesPrefix,
  onChangeSeriesSuffix,
}: SeriesNumberFormatControlProps) => {
  // Local state for the input fields
  const [decimalPlacesInput, setDecimalPlacesInput] = useState(
    initialDecimalPlaces || '2'
  )
  const [multiplierInput, setMultiplierInput] = useState(
    initialMultiplier || '1'
  )

  // Update local state when props change (from outside this component)
  useEffect(() => {
    if (initialDecimalPlaces) {
      setDecimalPlacesInput(initialDecimalPlaces)
    }
  }, [initialDecimalPlaces])

  useEffect(() => {
    if (initialMultiplier) {
      setMultiplierInput(initialMultiplier)
    }
  }, [initialMultiplier])

  // Handler for decimal places changes
  const handleDecimalPlacesChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      // Always update local state to show what the user is typing
      setDecimalPlacesInput(inputValue)

      // Always update the parent's record of the input value
      onChangeSeriesDecimalPlaces(series.id, inputValue)

      const { numValue } = parseDecimalPlaces(inputValue)
      onSeriesDecimalPlacesBlur(series.id, numValue.toString())
    },
    [series.id, onChangeSeriesDecimalPlaces, onSeriesDecimalPlacesBlur]
  )

  // Handler for decimal places blur
  const handleDecimalPlacesBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      // Special case for "0" - we want to allow zero decimal places
      if (inputValue === '0') {
        setDecimalPlacesInput('0')
        onChangeSeriesDecimalPlaces(series.id, '0')
        onSeriesDecimalPlacesBlur(series.id, '0')
        return
      }

      const { cleanedValue } = parseDecimalPlaces(inputValue)

      // If the cleaned value is empty, default to "0"
      const finalValue = cleanedValue || '0'

      setDecimalPlacesInput(finalValue)
      onChangeSeriesDecimalPlaces(series.id, finalValue)
      onSeriesDecimalPlacesBlur(series.id, finalValue)
    },
    [series.id, onChangeSeriesDecimalPlaces, onSeriesDecimalPlacesBlur]
  )

  // Handler for multiplier changes
  const handleMultiplierChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      // Always update local state to show what the user is typing
      setMultiplierInput(inputValue)

      // Always update the parent's record of the input value
      onChangeSeriesMultiplier(series.id, inputValue)

      const { numValue } = parseMultiplier(inputValue)
      onSeriesMultiplierBlur(series.id, numValue.toString())
    },
    [series.id, onChangeSeriesMultiplier, onSeriesMultiplierBlur]
  )

  // Handler for multiplier blur
  const handleMultiplierBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value

      const { cleanedValue } = parseMultiplier(inputValue)

      setMultiplierInput(cleanedValue)
      onChangeSeriesMultiplier(series.id, cleanedValue)
      onSeriesMultiplierBlur(series.id, cleanedValue)
    },
    [series.id, onChangeSeriesMultiplier, onSeriesMultiplierBlur]
  )

  return (
    <>
      <AxisModifierSelector
        label="Style"
        value={series.numberFormat?.style || 'normal'}
        options={NUMBER_STYLE_OPTIONS}
        onChange={(style) => onChangeSeriesNumberStyle(series.id, style)}
        disabled={!dataframe || !isEditable}
      />

      <div className="mt-4">
        <AxisModifierSelector
          label="Separator style"
          value={series.numberFormat?.separatorStyle || '999,999.99'}
          options={NUMBER_SEPARATOR_OPTIONS}
          onChange={(style) => onChangeSeriesSeparatorStyle(series.id, style)}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`decimalPlaces-${series.id}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Number of decimal places
        </label>
        <input
          name={`decimalPlaces-${series.id}`}
          type="text"
          min="0"
          max="10"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={decimalPlacesInput}
          onChange={handleDecimalPlacesChange}
          onBlur={handleDecimalPlacesBlur}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`multiplier-${series.id}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Multiply by a number
        </label>
        <input
          name={`multiplier-${series.id}`}
          type="text"
          step="any"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={multiplierInput}
          onChange={handleMultiplierChange}
          onBlur={handleMultiplierBlur}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`prefix-${series.id}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Add a prefix
        </label>
        <input
          name={`prefix-${series.id}`}
          type="text"
          placeholder="$"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={series.numberFormat?.prefix ?? ''}
          onChange={(e) => onChangeSeriesPrefix(series.id, e.target.value)}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`suffix-${series.id}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Add a suffix
        </label>
        <input
          name={`suffix-${series.id}`}
          type="text"
          placeholder="dollars"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={series.numberFormat?.suffix ?? ''}
          onChange={(e) => onChangeSeriesSuffix(series.id, e.target.value)}
          disabled={!dataframe || !isEditable}
        />
      </div>
    </>
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
  // Build the axis name components
  const axisNameComponents = useMemo(
    () =>
      yAxes.map((yAxis, yI) => (
        <div key={yAxis.id}>
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
            disabled={!dataframe || !isEditable}
          />
        </div>
      )),
    [yAxes, dataframe, isEditable, onChangeYAxisName]
  )

  // Build the formatting controls for each series
  const seriesFormatComponents = useMemo(() => {
    return yAxes.flatMap((yAxis, yAxisIndex) =>
      yAxis.series
        .map((series, seriesIndex) => {
          if (!series.column) return null

          const isDateColumn =
            series.column &&
            NumpyDateTypes.safeParse(series.column.type).success

          const isNumberColumn =
            series.column &&
            NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(
              series.column.type
            ).success

          if (!isDateColumn && !isNumberColumn) return null

          const seriesTitle = `${
            yAxisIndex === 0 ? 'Primary' : 'Secondary'
          } Y-Axis, Series ${seriesIndex + 1}${
            series.name ? `: ${series.name}` : ''
          }`

          return (
            <div key={series.id} className="border-t border-gray-200 pt-5">
              <h3 className="text-xs font-medium pb-4">{seriesTitle}</h3>

              {/* Date formatting options */}
              {isDateColumn && (
                <>
                  <AxisModifierSelector
                    label="Date style"
                    value={series.dateFormat?.dateStyle || null}
                    options={DATE_FORMAT_OPTIONS}
                    onChange={(style) =>
                      onChangeSeriesDateStyle(series.id, style)
                    }
                    disabled={!dataframe || !isEditable}
                  />

                  <div className="mt-4">
                    <VisualizationToggleV2
                      label="Show time"
                      enabled={series.dateFormat?.showTime || false}
                      onToggle={() => onToggleSeriesShowTime(series.id)}
                    />
                  </div>

                  {series.dateFormat?.showTime && (
                    <div className="mt-4">
                      <AxisModifierSelector
                        label="Time format"
                        value={series.dateFormat?.timeFormat || null}
                        options={TIME_FORMAT_OPTIONS}
                        onChange={(format) =>
                          onChangeSeriesTimeFormat(series.id, format)
                        }
                        disabled={!dataframe || !isEditable}
                      />
                    </div>
                  )}
                </>
              )}

              {/* Number formatting options */}
              {isNumberColumn && (
                <SeriesNumberFormatControl
                  series={series}
                  isEditable={isEditable}
                  dataframe={dataframe}
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
            </div>
          )
        })
        .filter(Boolean)
    )
  }, [
    yAxes,
    dataframe,
    isEditable,
    seriesDecimalPlaces,
    seriesMultiplier,
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
  ])

  return (
    <div className="text-xs text-gray-500 flex flex-col space-y-8">
      {axisNameComponents}
      {seriesFormatComponents}
    </div>
  )
}

export default YAxisTab
