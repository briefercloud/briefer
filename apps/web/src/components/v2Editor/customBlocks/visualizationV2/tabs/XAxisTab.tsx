import {
  ChangeEvent,
  FocusEvent,
  useCallback,
  useEffect,
  useState,
} from 'react'
import {
  DataFrameColumn,
  DataFrame,
  NumpyDateTypes,
  NumpyNumberTypes,
  NumpyTimeDeltaTypes,
  DateFormatStyle,
} from '@briefer/types'
import { VisualizationV2BlockInput } from '@briefer/editor'
import { parseDecimalPlaces, parseMultiplier } from '../VisualizationControls'
import { NumberFormatControl, DateFormatControl } from '../FormatControls'

interface XAxisTabProps {
  dataframe: DataFrame | null
  xAxis: DataFrameColumn | null
  xAxisName: string | null
  onChangeXAxisName: (name: string | null) => void
  xAxisDateFormat: VisualizationV2BlockInput['xAxisDateFormat']
  onChangeXAxisDateFormat: (
    dateFormat: NonNullable<VisualizationV2BlockInput['xAxisDateFormat']>
  ) => void
  xAxisNumberFormat: VisualizationV2BlockInput['xAxisNumberFormat']
  onChangeXAxisNumberFormat: (
    format: VisualizationV2BlockInput['xAxisNumberFormat']
  ) => void
  isEditable: boolean
}

const XAxisTab = ({
  dataframe,
  xAxis,
  xAxisName,
  onChangeXAxisName,
  xAxisDateFormat,
  onChangeXAxisDateFormat,
  xAxisNumberFormat,
  onChangeXAxisNumberFormat,
  isEditable,
}: XAxisTabProps) => {
  // State variables to track raw input strings for number formatting
  const [decimalPlacesInput, setDecimalPlacesInput] = useState<string>(
    () => xAxisNumberFormat?.decimalPlaces?.toString() || '2'
  )
  const [multiplierInput, setMultiplierInput] = useState<string>(
    () => xAxisNumberFormat?.multiplier?.toString() || '1'
  )

  // Update the input strings when the actual values change (e.g. from outside)
  useEffect(() => {
    setDecimalPlacesInput(xAxisNumberFormat?.decimalPlaces?.toString() || '2')
  }, [xAxisNumberFormat?.decimalPlaces])

  useEffect(() => {
    setMultiplierInput(xAxisNumberFormat?.multiplier?.toString() || '1')
  }, [xAxisNumberFormat?.multiplier])

  const handleChangeXAxisName = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (e.target.value === '') {
        onChangeXAxisName(null)
        return
      }
      onChangeXAxisName(e.target.value)
    },
    [onChangeXAxisName]
  )

  // Handler for date format changes
  const onChangeDateStyle = useCallback(
    (seriesId: string | undefined, dateStyle: string | null) => {
      if (!dateStyle) return

      if (xAxisDateFormat) {
        onChangeXAxisDateFormat({
          ...xAxisDateFormat,
          dateStyle: dateStyle as DateFormatStyle,
        })
      } else {
        onChangeXAxisDateFormat({
          dateStyle: dateStyle as DateFormatStyle,
          showTime: false,
          timeFormat: 'h:mm a',
        })
      }
    },
    [xAxisDateFormat, onChangeXAxisDateFormat]
  )

  // Handler for toggling time display
  const onToggleShowTime = useCallback(
    (seriesId: string | undefined) => {
      if (xAxisDateFormat) {
        onChangeXAxisDateFormat({
          ...xAxisDateFormat,
          showTime: !xAxisDateFormat.showTime,
        })
      } else {
        onChangeXAxisDateFormat({
          dateStyle: 'MMMM d, yyyy',
          showTime: true,
          timeFormat: 'h:mm a',
        })
      }
    },
    [xAxisDateFormat, onChangeXAxisDateFormat]
  )

  // Handler for time format changes
  const onChangeTimeFormat = useCallback(
    (seriesId: string | undefined, timeFormat: string | null) => {
      if (!timeFormat || !xAxisDateFormat) return

      onChangeXAxisDateFormat({
        ...xAxisDateFormat,
        timeFormat: timeFormat as any,
      })
    },
    [xAxisDateFormat, onChangeXAxisDateFormat]
  )

  // Shared function to update number format settings
  const updateNumberFormat = useCallback(
    (
      updates: Partial<
        NonNullable<VisualizationV2BlockInput['xAxisNumberFormat']>
      >
    ) => {
      if (xAxisNumberFormat) {
        onChangeXAxisNumberFormat({
          ...xAxisNumberFormat,
          ...updates,
        })
      } else {
        onChangeXAxisNumberFormat({
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
    [xAxisNumberFormat, onChangeXAxisNumberFormat]
  )

  // Handler for number format style changes
  const onChangeNumberStyle = useCallback(
    (seriesId: string | undefined, style: string | null) => {
      if (!style) return
      updateNumberFormat({
        style: style as 'normal' | 'percent' | 'scientific',
      })
    },
    [updateNumberFormat]
  )

  // Handler for separator style changes
  const onChangeSeparatorStyle = useCallback(
    (seriesId: string | undefined, separatorStyle: string | null) => {
      if (!separatorStyle) return
      updateNumberFormat({
        separatorStyle: separatorStyle as
          | '999,999.99'
          | '999.999,99'
          | '999 999,99'
          | '999999.99',
      })
    },
    [updateNumberFormat]
  )

  // Handler for decimal places changes
  const onChangeDecimalPlaces = useCallback(
    (seriesId: string | undefined, inputValue: string) => {
      setDecimalPlacesInput(inputValue)
      const { numValue } = parseDecimalPlaces(inputValue)
      updateNumberFormat({ decimalPlaces: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for decimal places blur
  const onDecimalPlacesBlur = useCallback(
    (seriesId: string | undefined, inputValue: string) => {
      const { numValue } = parseDecimalPlaces(inputValue)
      setDecimalPlacesInput(numValue.toString())
      updateNumberFormat({ decimalPlaces: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for multiplier changes
  const onChangeMultiplier = useCallback(
    (seriesId: string | undefined, inputValue: string) => {
      setMultiplierInput(inputValue)
      const { numValue } = parseMultiplier(inputValue)
      updateNumberFormat({ multiplier: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for multiplier blur
  const onMultiplierBlur = useCallback(
    (seriesId: string | undefined, inputValue: string) => {
      const { numValue } = parseMultiplier(inputValue)
      setMultiplierInput(numValue.toString())
      updateNumberFormat({ multiplier: numValue })
    },
    [updateNumberFormat]
  )

  // Update prefix and suffix handlers to use the shared updateNumberFormat function
  const onChangePrefix = useCallback(
    (seriesId: string | undefined, value: string) => {
      const formattedValue = value === '' ? null : value
      updateNumberFormat({ prefix: formattedValue })
    },
    [updateNumberFormat]
  )

  const onChangeSuffix = useCallback(
    (seriesId: string | undefined, value: string) => {
      const formattedValue = value === '' ? null : value
      updateNumberFormat({ suffix: formattedValue })
    },
    [updateNumberFormat]
  )

  // Check if the X-axis is a date or number column
  const isDateColumn = xAxis && NumpyDateTypes.safeParse(xAxis.type).success
  const isNumberColumn =
    xAxis &&
    NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(xAxis.type).success

  return (
    <div className="text-xs text-gray-500">
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">X-Axis</h2>

        <div className="mb-6">
          <label
            htmlFor="xAxisName"
            className="block text-xs font-medium leading-6 text-gray-900 pb-1"
          >
            Axis name
          </label>
          <input
            name="xAxisName"
            type="text"
            placeholder="My X-Axis"
            className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
            value={xAxisName ?? ''}
            onChange={handleChangeXAxisName}
            disabled={!dataframe || !isEditable}
          />
        </div>

        {/* Date formatting options - only show for date columns */}
        {isDateColumn && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
            <h3 className="text-xs font-medium mb-4">Date formatting</h3>
            <DateFormatControl
              currentFormat={xAxisDateFormat}
              dataframe={dataframe}
              isEditable={isEditable}
              onChangeDateStyle={onChangeDateStyle}
              onToggleShowTime={onToggleShowTime}
              onChangeTimeFormat={onChangeTimeFormat}
            />
          </div>
        )}

        {/* Number formatting options - only show for number columns */}
        {isNumberColumn && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md border border-gray-200 shadow-sm">
            <h3 className="text-xs font-medium mb-1 text-gray-900">
              Label formatting
            </h3>
            <NumberFormatControl
              initialDecimalPlaces={decimalPlacesInput}
              initialMultiplier={multiplierInput}
              currentFormat={xAxisNumberFormat}
              dataframe={dataframe}
              isEditable={isEditable}
              onChangeNumberStyle={onChangeNumberStyle}
              onChangeSeparatorStyle={onChangeSeparatorStyle}
              onChangeDecimalPlaces={onChangeDecimalPlaces}
              onDecimalPlacesBlur={onDecimalPlacesBlur}
              onChangeMultiplier={onChangeMultiplier}
              onMultiplierBlur={onMultiplierBlur}
              onChangePrefix={onChangePrefix}
              onChangeSuffix={onChangeSuffix}
            />
          </div>
        )}

        {/* No formatting options - show for columns that are neither date nor number */}
        {xAxis && !isDateColumn && !isNumberColumn && (
          <div className="mb-6 p-4 bg-gray-50 rounded-md">
            <div className="text-center py-4">
              <p className="text-gray-500">
                No formatting options are available for this column type.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default XAxisTab
