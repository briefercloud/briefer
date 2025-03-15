import {
  ChangeEvent,
  FocusEvent,
  useState,
  useEffect,
  useCallback,
} from 'react'
import {
  DATE_FORMAT_OPTIONS,
  TIME_FORMAT_OPTIONS,
  NUMBER_STYLE_OPTIONS,
  NUMBER_SEPARATOR_OPTIONS,
} from '@briefer/editor'
import AxisModifierSelector from '@/components/AxisModifierSelector'
import VisualizationToggleV2 from './VisualizationToggle'

// Generic interface for number formatting props
export interface NumberFormatControlProps {
  initialDecimalPlaces: string
  initialMultiplier: string
  currentFormat: {
    style?: string | null
    separatorStyle?: string | null
    prefix?: string | null
    suffix?: string | null
  } | null
  dataframe: any | null
  isEditable: boolean
  seriesId?: string // Optional for XAxis
  onChangeNumberStyle: (id: string | undefined, style: string | null) => void
  onChangeSeparatorStyle: (id: string | undefined, style: string | null) => void
  onChangeDecimalPlaces: (id: string | undefined, value: string) => void
  onDecimalPlacesBlur: (id: string | undefined, value: string) => void
  onChangeMultiplier: (id: string | undefined, value: string) => void
  onMultiplierBlur: (id: string | undefined, value: string) => void
  onChangePrefix: (id: string | undefined, value: string) => void
  onChangeSuffix: (id: string | undefined, value: string) => void
}

export const NumberFormatControl = ({
  initialDecimalPlaces,
  initialMultiplier,
  currentFormat,
  dataframe,
  isEditable,
  seriesId,
  onChangeNumberStyle,
  onChangeSeparatorStyle,
  onChangeDecimalPlaces,
  onDecimalPlacesBlur,
  onChangeMultiplier,
  onMultiplierBlur,
  onChangePrefix,
  onChangeSuffix,
}: NumberFormatControlProps) => {
  // Local state for the input fields
  const [decimalPlacesInput, setDecimalPlacesInput] = useState(
    initialDecimalPlaces || '2'
  )
  const [multiplierInput, setMultiplierInput] = useState(
    initialMultiplier || '1'
  )

  // Update local state when props change
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
      setDecimalPlacesInput(inputValue)
      onChangeDecimalPlaces(seriesId, inputValue)
    },
    [seriesId, onChangeDecimalPlaces]
  )

  // Handler for decimal places blur
  const handleDecimalPlacesBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      onDecimalPlacesBlur(seriesId, inputValue)
    },
    [seriesId, onDecimalPlacesBlur]
  )

  // Handler for multiplier changes
  const handleMultiplierChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      setMultiplierInput(inputValue)
      onChangeMultiplier(seriesId, inputValue)
    },
    [seriesId, onChangeMultiplier]
  )

  // Handler for multiplier blur
  const handleMultiplierBlur = useCallback(
    (e: FocusEvent<HTMLInputElement>) => {
      const inputValue = e.target.value
      onMultiplierBlur(seriesId, inputValue)
    },
    [seriesId, onMultiplierBlur]
  )

  // Handler for prefix/suffix changes
  const handlePrefixChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChangePrefix(seriesId, e.target.value)
    },
    [seriesId, onChangePrefix]
  )

  const handleSuffixChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChangeSuffix(seriesId, e.target.value)
    },
    [seriesId, onChangeSuffix]
  )

  return (
    <>
      <AxisModifierSelector
        label="Number Format"
        value={currentFormat?.style || 'normal'}
        options={NUMBER_STYLE_OPTIONS}
        onChange={(style) => onChangeNumberStyle(seriesId, style)}
        disabled={!dataframe || !isEditable}
      />

      <div className="mt-4">
        <AxisModifierSelector
          label="Separator"
          value={currentFormat?.separatorStyle || '999,999.99'}
          options={NUMBER_SEPARATOR_OPTIONS}
          onChange={(style) => onChangeSeparatorStyle(seriesId, style)}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`decimalPlaces-${seriesId || 'x'}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Number of decimal places
        </label>
        <input
          name={`decimalPlaces-${seriesId || 'x'}`}
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
          htmlFor={`multiplier-${seriesId || 'x'}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Multiply by a number
        </label>
        <input
          name={`multiplier-${seriesId || 'x'}`}
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
          htmlFor={`prefix-${seriesId || 'x'}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Prefix
        </label>
        <input
          name={`prefix-${seriesId || 'x'}`}
          type="text"
          placeholder="$"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={currentFormat?.prefix ?? ''}
          onChange={handlePrefixChange}
          disabled={!dataframe || !isEditable}
        />
      </div>

      <div className="mt-4">
        <label
          htmlFor={`suffix-${seriesId || 'x'}`}
          className="block text-xs font-medium leading-6 text-gray-900 pb-1"
        >
          Suffix
        </label>
        <input
          name={`suffix-${seriesId || 'x'}`}
          type="text"
          placeholder="dollars"
          className="w-full border-0 rounded-md ring-1 ring-inset ring-gray-200 focus:ring-1 focus:ring-inset focus:ring-gray-300 bg-white group px-2.5 text-gray-800 text-xs placeholder:text-gray-400"
          value={currentFormat?.suffix ?? ''}
          onChange={handleSuffixChange}
          disabled={!dataframe || !isEditable}
        />
      </div>
    </>
  )
}

// Generic interface for date formatting props
export interface DateFormatControlProps {
  currentFormat: {
    dateStyle?: string | null
    showTime?: boolean
    timeFormat?: string | null
  } | null
  dataframe: any | null
  isEditable: boolean
  seriesId?: string // Optional for XAxis
  onChangeDateStyle: (id: string | undefined, style: string | null) => void
  onToggleShowTime: (id: string | undefined) => void
  onChangeTimeFormat: (id: string | undefined, format: string | null) => void
}

export const DateFormatControl = ({
  currentFormat,
  dataframe,
  isEditable,
  seriesId,
  onChangeDateStyle,
  onToggleShowTime,
  onChangeTimeFormat,
}: DateFormatControlProps) => {
  return (
    <>
      <AxisModifierSelector
        label="Date style"
        value={currentFormat?.dateStyle || null}
        options={DATE_FORMAT_OPTIONS}
        onChange={(style) => onChangeDateStyle(seriesId, style)}
        disabled={!dataframe || !isEditable}
      />

      <div className="mt-4">
        <VisualizationToggleV2
          label="Show time"
          enabled={currentFormat?.showTime || false}
          onToggle={() => onToggleShowTime(seriesId)}
        />
      </div>

      {currentFormat?.showTime && (
        <div className="mt-4">
          <AxisModifierSelector
            label="Time format"
            value={currentFormat?.timeFormat || null}
            options={TIME_FORMAT_OPTIONS}
            onChange={(format) => onChangeTimeFormat(seriesId, format)}
            disabled={!dataframe || !isEditable}
          />
        </div>
      )}
    </>
  )
}
