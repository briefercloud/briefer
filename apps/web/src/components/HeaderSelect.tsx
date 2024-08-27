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
        <div className="min-w-[200px] relative overflow-visible font-normal">
          <Listbox.Button
            as="div"
            className="bg-white cursor-default h-6 relative w-full rounded-md pl-2 pr-10 text-left text-gray-500 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-xs flex items-center"
          >
            <span className="block truncate">{selectedOptionContent}</span>
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
              className="absolute z-10 max-h-60 w-full overflow-auto rounded-sm bg-white pt-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-xs"
            >
              {options.map((option) => (
                <Listbox.Option
                  key={option.value}
                  as="div"
                  className={({ active }) =>
                    clsx(
                      active ? 'bg-primary-200' : '',
                      'relative select-none py-1.5 pl-3 pr-9 text-gray-900 hover:cursor-pointer'
                    )
                  }
                  value={option.value}
                >
                  {({ selected, active }) => (
                    <>
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
                    </>
                  )}
                </Listbox.Option>
              ))}
              {props.onAdd && (
                <button
                  onClick={props.onAdd}
                  className="flex items-center w-full text-left mt-1 py-2 pl-3 pr-9 text-gray-900 border-t border-gray-200 hover:bg-primary-200 space-x-1"
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
