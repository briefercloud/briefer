import React, { useCallback, useMemo } from 'react'

import { DayPicker } from 'react-day-picker'
import clsx from 'clsx'
import { DateInputValue } from '@briefer/editor'

interface Props {
  value: DateInputValue
  dateType: 'date' | 'datetime'
  disabled: boolean
  onChange: (value: DateInputValue) => void
}
function DatePicker(props: Props) {
  const selected = useMemo(() => {
    switch (props.dateType) {
      case 'date':
        return new Date(
          props.value.year,
          props.value.month - 1,
          props.value.day
        )
      case 'datetime':
        return new Date(
          props.value.year,
          props.value.month - 1,
          props.value.day,
          props.value.hours,
          props.value.minutes,
          props.value.seconds
        )
    }
  }, [props.value, props.dateType])

  const onSelect = useCallback(
    (newSelected: Date | undefined) => {
      if (!newSelected) {
        return
      }

      const newValue = {
        ...props.value,
        year: newSelected.getFullYear(),
        month: newSelected.getMonth() + 1,
        day: newSelected.getDate(),
      }

      props.onChange(newValue)
    },
    [props.onChange, props.value]
  )

  const time = useMemo(
    () =>
      `${props.value.hours.toString().padStart(2, '0')}:${props.value.minutes
        .toString()
        .padStart(2, '0')}:${props.value.seconds.toString().padStart(2, '0')}`,
    [props.value.hours, props.value.minutes, props.value.seconds]
  )

  const onChangeTime = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = e.target.value
      const parts = time.split(':').map((str) => parseInt(str, 10))

      let hours = parts[0] ?? 0
      if (Number.isNaN(hours)) {
        hours = 0
      }
      let minutes = parts[1] ?? 0
      if (Number.isNaN(minutes)) {
        minutes = 0
      }
      let seconds = parts[2] ?? 0
      if (Number.isNaN(seconds)) {
        seconds = 0
      }

      props.onChange({
        ...props.value,
        hours,
        minutes,
        seconds,
      })
    },
    [props.onChange, props.value]
  )

  return (
    <div className="pb-1">
      <DayPicker
        mode="single"
        required={false}
        selected={selected}
        onSelect={onSelect}
        disabled={props.disabled}
      />
      <div
        className={clsx(
          'w-full pt-1 px-1',
          props.dateType === 'datetime' ? 'block' : 'hidden'
        )}
      >
        <span className="font-medium text-xs text-gray-400">
          Time (24h format)
        </span>
        <input
          type="time"
          step={2}
          className="border border-gray-200 focus:border-ceramic-300 rounded-md ring-0 focus:ring-0 w-full px-2 py-1.5"
          value={time}
          onChange={onChangeTime}
        />
      </div>
    </div>
  )
}

export default DatePicker
