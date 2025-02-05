import { Fragment, useCallback } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import {
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'

type Option = { value: string; label: string }

interface Props {
  options: Option[]
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  onAdd?: () => void
  onAddLabel?: string
  placeholders?: [string, string]
}
export default function HeaderSelect(props: Props) {
  const { options, value, disabled } = props

  const hasOptions = options.length > 0
  const isDisabled = disabled || !hasOptions
  const selectedOptionContent = hasOptions
    ? options.find((option) => option.value === value)?.label ||
      (props.placeholders?.[0] ?? 'No data source selected')
    : props.placeholders?.[1] ?? 'No data sources'

  const onChange = useCallback(
    (value: string) => {
      if (!isDisabled) {
        props.onChange(value)
      }
    },
    [isDisabled, props.onChange]
  )

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      {({ open }) => (
        <div className="h-full w-56 max-w-56 relative overflow-visible font-normal">
          <Listbox.Button
            as="div"
            className="h-full relative w-full rounded-tr-md pl-3 pr-10 text-left text-gray-500 sm:text-xs flex items-center bg-gray-50 hover:bg-gray-100 cursor-pointer"
          >
            <div className="flex gap-x-3 items-center font-mono overflow-hidden">
              <span className="block truncate">{selectedOptionContent}</span>
            </div>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <ChevronUpDownIcon
                className="h-3 w-3 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              as="div"
              className="mt-[1px] absolute z-10 max-h-60 w-full overflow-auto bg-white text-base shadow-lg ring-1 ring-gray-200 focus:outline-none sm:text-xs w-[calc(100%-1px)]"
            >
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  as="div"
                  className={({ active }) =>
                    clsx(
                      active ? 'bg-blue-50' : '',
                      'relative select-none pl-3 pr-9 text-gray-900 hover:cursor-pointer py-3'
                    )
                  }
                  value={option.value}
                >
                  {({ selected, active }) => (
                    <div className="flex gap-x-3 items-center font-mono overflow-hidden">
                      <span
                        className={clsx(
                          selected ? 'font-semibold' : 'font-normal',
                          'block truncate'
                        )}
                      >
                        {option.label}
                      </span>

                      {selected ? (
                        <span
                          className={clsx(
                            active ? 'text-white' : 'text-primary-200',
                            'absolute inset-y-0 right-0 flex items-center pr-4'
                          )}
                        >
                          <CheckIcon
                            className="text-gray-900 h-3 w-3"
                            aria-hidden="true"
                          />
                        </span>
                      ) : null}
                    </div>
                  )}
                </Listbox.Option>
              ))}
              {props.onAdd && (
                <button
                  onClick={props.onAdd}
                  className="flex items-center w-full text-left mt-1 py-2 pl-3 pr-9 text-gray-900 border-t border-gray-200 hover:bg-blue-50 space-x-1 h-10"
                >
                  <PlusIcon className="h-3 w-3" aria-hidden="true" />
                  <span>{props.onAddLabel ?? ''}</span>
                </button>
              )}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}
