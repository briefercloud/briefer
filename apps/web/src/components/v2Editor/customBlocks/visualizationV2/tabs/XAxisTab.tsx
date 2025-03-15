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
} from '@briefer/types'
import {
  VisualizationV2BlockInput,
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  NUMBER_SEPARATOR_OPTIONS,
} from '@briefer/editor'
import { parseDecimalPlaces, parseMultiplier } from '../VisualizationControls'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import VisualizationToggleV2 from '../VisualizationToggle'

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
    (dateStyle: string | null) => {
      if (!dateStyle) return

      if (xAxisDateFormat) {
        onChangeXAxisDateFormat({
          ...xAxisDateFormat,
          dateStyle: dateStyle as any,
        })
      } else {
        onChangeXAxisDateFormat({
          dateStyle: dateStyle as any,
          showTime: false,
          timeFormat: 'h:mm a',
        })
      }
    },
    [xAxisDateFormat, onChangeXAxisDateFormat]
  )

  // Handler for toggling time display
  const onToggleShowTime = useCallback(() => {
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
  }, [xAxisDateFormat, onChangeXAxisDateFormat])

  // Handler for time format changes
  const onChangeTimeFormat = useCallback(
    (timeFormat: string | null) => {
      if (!timeFormat || !xAxisDateFormat) return

      onChangeXAxisDateFormat({
        ...xAxisDateFormat,
        timeFormat: timeFormat as any,
      })
    },
    [xAxisDateFormat, onChangeXAxisDateFormat]
  )

  // Handler for number format style changes
  const onChangeNumberStyle = useCallback(
    (style: string | null) => {
      if (!style) return

      if (xAxisNumberFormat) {
        onChangeXAxisNumberFormat({
          ...xAxisNumberFormat,
          style: style as 'normal' | 'percent' | 'scientific',
        })
      } else {
        onChangeXAxisNumberFormat({
          style: style as 'normal' | 'percent' | 'scientific',
          separatorStyle: '999,999.99',
          decimalPlaces: 2,
          multiplier: 1,
          prefix: null,
          suffix: null,
        })
      }
    },
    [xAxisNumberFormat, onChangeXAxisNumberFormat]
  )

  // Handler for separator style changes
  const onChangeSeparatorStyle = useCallback(
    (separatorStyle: string | null) => {
      if (!separatorStyle) return

      if (xAxisNumberFormat) {
        onChangeXAxisNumberFormat({
          ...xAxisNumberFormat,
          separatorStyle: separatorStyle as
            | '999,999.99'
            | '999.999,99'
            | '999 999,99'
            | '999999.99',
        })
      } else {
        onChangeXAxisNumberFormat({
          style: 'normal',
          separatorStyle: separatorStyle as
            | '999,999.99'
            | '999.999,99'
            | '999 999,99'
            | '999999.99',
          decimalPlaces: 2,
          multiplier: 1,
          prefix: null,
          suffix: null,
        })
      }
    },
    [xAxisNumberFormat, onChangeXAxisNumberFormat]
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

  // Handler for decimal places changes
  const onChangeDecimalPlaces = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setDecimalPlacesInput(inputValue)

      const { numValue } = parseDecimalPlaces(inputValue)
      updateNumberFormat({ decimalPlaces: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for decimal places blur
  const onDecimalPlacesBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const { numValue } = parseDecimalPlaces(inputValue)

      setDecimalPlacesInput(numValue.toString())
      updateNumberFormat({ decimalPlaces: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for multiplier changes
  const onChangeMultiplier = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setMultiplierInput(inputValue)

      const { numValue } = parseMultiplier(inputValue)
      updateNumberFormat({ multiplier: numValue })
    },
    [updateNumberFormat]
  )

  // Handler for multiplier blur
  const onMultiplierBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      const { numValue } = parseMultiplier(inputValue)

      setMultiplierInput(numValue.toString())
      updateNumberFormat({ multiplier: numValue })
    },
    [updateNumberFormat]
  )

  // Update prefix and suffix handlers to use the shared updateNumberFormat function
  const onChangePrefix = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === '' ? null : e.target.value
      updateNumberFormat({ prefix: value })
    },
    [updateNumberFormat]
  )

  const onChangeSuffix = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value === '' ? null : e.target.value
      updateNumberFormat({ suffix: value })
    },
    [updateNumberFormat]
  )

  return (
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
          value={xAxisName ?? ''}
          onChange={handleChangeXAxisName}
          disabled={!dataframe || !isEditable}
        />
      </div>

      {/* Date formatting options - only show for date columns */}
      {xAxis && NumpyDateTypes.safeParse(xAxis.type).success && (
        <>
          <div className="border-t border-gray-200 pt-5">
            {/* Date style dropdown */}
            <AxisModifierSelector
              label="Date style"
              value={xAxisDateFormat?.dateStyle || null}
              options={DATE_FORMAT_OPTIONS}
              onChange={onChangeDateStyle}
              disabled={!dataframe || !isEditable}
            />

            {/* Show time toggle */}
            <div className="mt-4">
              <VisualizationToggleV2
                label="Show time"
                enabled={xAxisDateFormat?.showTime || false}
                onToggle={onToggleShowTime}
              />
            </div>

            {/* Time format dropdown - only show when showTime is true */}
            {xAxisDateFormat?.showTime && (
              <div className="mt-4">
                <AxisModifierSelector
                  label="Time format"
                  value={xAxisDateFormat?.timeFormat || null}
                  options={TIME_FORMAT_OPTIONS}
                  onChange={onChangeTimeFormat}
                  disabled={!dataframe || !isEditable}
                />
              </div>
            )}
          </div>
        </>
      )}

      {/* Number formatting options - only show for number columns */}
      {xAxis &&
        NumpyNumberTypes.or(NumpyTimeDeltaTypes).safeParse(xAxis.type)
          .success && (
          <>
            <div className="border-t border-gray-200 pt-5">
              <h3 className="text-xs font-medium pb-4">Number format</h3>

              {/* Style selector */}
              <AxisModifierSelector
                label="Style"
                value={xAxisNumberFormat?.style || 'normal'}
                options={NUMBER_STYLE_OPTIONS}
                onChange={onChangeNumberStyle}
                disabled={!dataframe || !isEditable}
              />

              {/* Separator style selector */}
              <div className="mt-4">
                <AxisModifierSelector
                  label="Separator style"
                  value={xAxisNumberFormat?.separatorStyle || '999,999.99'}
                  options={NUMBER_SEPARATOR_OPTIONS}
                  onChange={onChangeSeparatorStyle}
                  disabled={!dataframe || !isEditable}
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
                  disabled={!dataframe || !isEditable}
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
                  disabled={!dataframe || !isEditable}
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
                  value={xAxisNumberFormat?.prefix ?? ''}
                  onChange={onChangePrefix}
                  disabled={!dataframe || !isEditable}
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
                  value={xAxisNumberFormat?.suffix ?? ''}
                  onChange={onChangeSuffix}
                  disabled={!dataframe || !isEditable}
                />
              </div>
            </div>
          </>
        )}
    </div>
  )
}

export default XAxisTab
