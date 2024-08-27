import { Fragment } from 'react' // Import useEffect
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'

type Option = { value: string; label: string }

type SelectProps = {
  label: string
  options: Option[]
  value: string
  onChange: (value: string) => void
}

export default function Select({
  label,
  options,
  value,
  onChange,
}: SelectProps) {
  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className="flex-1">
          <Listbox.Label className="block text-xs text-gray-400 font-medium leading-6">
            {label}
          </Listbox.Label>
          <div className="relative">
            <Listbox.Button className=" relative w-full cursor-default rounded-sm bg-white py-1 pl-3 pr-10 text-left text-gray-500 ring-1 ring-inset ring-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-200 sm:text-sm sm:leading-6">
              <span className="block truncate">
                {options.find((option) => option.value === value)?.label}
              </span>
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                <ChevronUpDownIcon
                  className="h-5 w-5 text-gray-400"
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
                className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm"
              >
                {options.map((option) => (
                  <Listbox.Option
                    key={option.value}
                    as="div"
                    className={({ active }) =>
                      clsx(
                        active ? 'bg-primary-200' : '',
                        'relative cursor-default select-none py-2 pl-3 pr-9 text-gray-900'
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
                              className="text-gray-900 h-5 w-5"
                              aria-hidden="true"
                            />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </Transition>
          </div>
        </div>
      )}
    </Listbox>
  )
}
