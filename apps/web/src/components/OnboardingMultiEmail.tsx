import React, { useCallback, useMemo } from 'react'
import { UseControllerProps, useController } from 'react-hook-form'
import { XMarkIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { ThirdStepFormValues } from '@/components/forms/NewWorkspace'

type MultiEmailInputProps = UseControllerProps<
  ThirdStepFormValues,
  'inviteEmails'
>

const MultiEmailInput = (props: MultiEmailInputProps) => {
  const controller = useController(props)

  const currentValue = useMemo(
    () => controller.field.value || [],
    [controller.field.value]
  )

  const [unfinishedValue, setUnfinishedValue] = React.useState('')

  const onChangeUnfinishedValue = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setUnfinishedValue(e.target.value)
    },
    []
  )

  const onInputKeydown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' || e.key === ',') {
        // Submit when pressing enter on the empty input with a value
        if (currentValue.length && !unfinishedValue && e.key === 'Enter') {
          return
        }

        if (unfinishedValue) {
          e.preventDefault()
          const newEmailList = [...currentValue, unfinishedValue]
          controller.field.onChange(newEmailList)
          setUnfinishedValue('')
        }
      }

      // Delete previous crumb when pressing backspace on empty input
      if (e.key === 'Backspace' && unfinishedValue === '') {
        e.preventDefault()
        const newEmailList = [...currentValue]
        newEmailList.pop()
        controller.field.onChange(newEmailList)
      }
    },
    [controller.field, currentValue, unfinishedValue]
  )

  // save email on blur too
  const onBlur = useCallback(() => {
    if (unfinishedValue) {
      const newEmailList = [...currentValue, unfinishedValue]
      controller.field.onChange(newEmailList)
      setUnfinishedValue('')
    }
  }, [controller.field, currentValue, unfinishedValue])

  return (
    <div
      className={clsx(
        currentValue.length ? 'p-0.5' : 'p-0.5',
        'flex flex-wrap border border-gray-200  rounded-md shadow-sm w-96'
      )}
    >
      <div className="flex flex-wrap">
        {currentValue.map((email, index) => (
          <div className="px-1 py-1">
            <div
              key={index}
              className="bg-gray-50 border border-gray-200 px-2 py-1 rounded-sm flex items-center gap-x-1 text-sm"
            >
              <span>{email}</span>
              <button
                type="button"
                onClick={() => {
                  const newEmailList = [...currentValue]
                  newEmailList.splice(index, 1)
                  controller.field.onChange(newEmailList)
                }}
                className="rounded-full mt-0.5 p-0.5 hover:bg-gray-200"
              >
                <XMarkIcon className="w-3 h-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        type="text"
        value={unfinishedValue}
        onChange={onChangeUnfinishedValue}
        onKeyDown={onInputKeydown}
        onBlur={onBlur}
        placeholder="Type email and press enter or ,"
        className="flex-1 border-0 focus:ring-0 focus:outline-0 rounded-md text-md placeholder-gray-300"
      />
    </div>
  )
}

export default MultiEmailInput
