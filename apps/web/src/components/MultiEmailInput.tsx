import React, { useCallback } from 'react'
import { XMarkIcon } from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { ScheduleFormValues } from './Schedules/AddScheduleForm'

import { FieldValues, UseControllerProps, useController } from 'react-hook-form'

interface GenericMultiEmailProps<T extends FieldValues>
  extends UseControllerProps<T> {}

const getValidEmail = (email: string) => {
  const trimmedEmail = email.trim()
  return trimmedEmail.includes('@') ? trimmedEmail : null
}

const MultiEmailInput = <T extends FieldValues>(
  props: GenericMultiEmailProps<T>
) => {
  const controller = useController(props)

  const currentValue = controller.field.value || []

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
          const validEmail = getValidEmail(unfinishedValue)
          if (!validEmail) {
            return
          }

          const newEmailList = [...currentValue, validEmail]
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
      const validEmail = getValidEmail(unfinishedValue)
      if (!validEmail) {
        return
      }

      const newEmailList = [...currentValue, validEmail]
      controller.field.onChange(newEmailList)
      setUnfinishedValue('')
    }
  }, [controller.field, currentValue, unfinishedValue])

  return (
    <div className="flex flex-col gap-y-2">
      <label className="block text-sm font-medium leading-6 text-gray-900">
        Emails to notify
      </label>

      <div
        className={clsx(
          currentValue.length > 0 ? 'p-2' : 'py-0.5',
          'flex flex-wrap border border-gray-200  rounded-md shadow-sm'
        )}
      >
        <div className="flex flex-wrap">
          {currentValue.map((email, index) => (
            <div className="px-1 py-1">
              <div
                key={index}
                className="bg-gray-50 border border-gray-200 px-2 py-1 rounded-sm flex items-center gap-x-1 text-xs"
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
          className="flex-1 border-0 focus:ring-0 focus:outline-0 rounded-md text-sm placeholder-gray-400"
        />
      </div>
    </div>
  )
}

export default MultiEmailInput
