import clsx from 'clsx'
import React, { useCallback } from 'react'
import { UseControllerProps, useController } from 'react-hook-form'
import { SecondStepFormValues } from '@/components/forms/NewWorkspace'

interface RadioOption {
  label: string
  value: string
}

type RadioSquaresProps = UseControllerProps<
  SecondStepFormValues,
  'useContext'
> & {
  options: RadioOption[]
}

const RadioSquares: React.FC<RadioSquaresProps> = (props) => {
  const controller = useController(props)

  const handleOptionChange = useCallback(
    (value: string) => {
      controller.field.onChange(value)
    },
    [controller.field]
  )

  return (
    <div className="flex space-x-4 text-sm items-center justify-center flex-wrap">
      {props.options.map((option) => (
        <button
          key={option.value}
          className={clsx(
            controller.field.value === option.value
              ? 'bg-primary-100'
              : 'bg-white',
            'flex flex-1 h-16 items-center justify-center border p-4 cursor-pointer shadow-sm'
          )}
          onClick={() => handleOptionChange(option.value)}
          type="button"
        >
          <span>{option.label}</span>
        </button>
      ))}
    </div>
  )
}

export default RadioSquares
