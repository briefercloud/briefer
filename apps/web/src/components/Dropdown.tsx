import { ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { CheckIcon } from 'lucide-react'
import { Listbox } from '@headlessui/react'
import { useMemo } from 'react'
import clsx from 'clsx'

interface Props {
  label: string
  disabled?: boolean
  options: { label: string; value: string }[]

  value?: string
  placeholder: string
  onChange: (value: string) => void
  icon?: (value: string) => React.ReactNode
  bg?: string
  fg?: string
}
function Dropdown(props: Props) {
  const currentValueLabel = useMemo(() => {
    return props.options.find((o) => o.value === props.value)?.label
  }, [props.options, props.value])

  return (
    <div>
      <Listbox
        value={props.value}
        onChange={props.onChange}
        disabled={props.disabled}
      >
        {({ open }) => (
          <>
            <Listbox.Label className="block text-xs font-medium leading-6 text-gray-900">
              {props.label}
            </Listbox.Label>
            <div className="relative pt-0.5">
              <Listbox.Button
                className={clsx(
                  'flex items-center relative w-full cursor-default rounded-md py-1.5 pl-3 pr-10 text-left shadow-sm ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6 focus:bg-white',
                  props.disabled
                    ? 'bg-gray-100 cursor-not-allowed text-gray-400'
                    : 'bg-white cursor-pointer text-gray-900'
                )}
              >
                {props.value && props.icon && (
                  <span className="mr-2">{props.icon(props.value)}</span>
                )}
                <span
                  className={clsx(
                    'block truncate h-6',
                    currentValueLabel ? 'text-gray-900' : 'text-gray-400'
                  )}
                >
                  {currentValueLabel ?? props.placeholder}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>

              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none data-[closed]:data-[leave]:opacity-0 data-[leave]:transition data-[leave]:duration-100 data-[leave]:ease-in sm:text-sm">
                {props.options.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    className={({ active }) =>
                      clsx(
                        active
                          ? clsx(
                              props.bg ?? 'bg-primary-600',
                              props.fg ?? 'text-white'
                            )
                          : '',
                        !active ? 'text-gray-900' : '',
                        'relative cursor-default select-none py-2 pl-3 pr-9'
                      )
                    }
                    value={option.value}
                  >
                    {({ selected, active }) => (
                      <div className="flex items-center">
                        {props.icon && (
                          <span className="mr-2">
                            {props.icon(option.value)}
                          </span>
                        )}
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
                              active
                                ? props.fg ?? 'text-white'
                                : props.fg ?? 'text-primary-600',
                              'absolute inset-y-0 right-0 flex items-center pr-4'
                            )}
                          >
                            <CheckIcon className="h-3 w-3" aria-hidden="true" />
                          </span>
                        ) : null}
                      </div>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </>
        )}
      </Listbox>
    </div>
  )
}
export default Dropdown
