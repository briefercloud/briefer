import { Fragment, useCallback, useMemo } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import {
  CheckIcon,
  ChevronUpDownIcon,
  PlusIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { DataSourceType, databaseImages } from '@/components/DataSourcesList'

type Option = {
  value: string
  label: string
  type: DataSourceType | 'duckdb'
  isDemo: boolean
}

interface Props {
  options: Option[]
  value: string
  onChange: (option: Option) => void
  disabled?: boolean
  hidden?: boolean
  onAdd?: () => void
  onAddLabel?: string
}
export default function HeaderSelect(props: Props) {
  const { value, disabled } = props
  const options = useMemo(
    () =>
      props.options.concat({
        label: 'Files (DuckDB)',
        value: 'duckdb',
        type: 'duckdb',
        isDemo: false,
      }),
    [props.options]
  )

  const hasOptions = options.length > 0
  const isDisabled = disabled || (!hasOptions && !props.onAdd)

  const selectedOption = hasOptions
    ? options.find((option) => option.value === value)
    : undefined

  const selectedOptionIcon =
    hasOptions && selectedOption && selectedOption.type !== 'duckdb'
      ? databaseImages(selectedOption.type)
      : undefined

  const selectedOptionLabel = hasOptions
    ? selectedOption?.label || 'No data source selected'
    : 'No data sources'

  const onChange = useCallback(
    (value: string) => {
      if (!isDisabled) {
        const option = options.find((option) => option.value === value)
        if (option) {
          props.onChange(option)
        }
      }
    },
    [isDisabled, props.onChange, options]
  )

  return (
    <Listbox
      as={'div'}
      className={clsx('h-full', props.hidden ? 'hidden' : 'block')}
      value={value}
      onChange={onChange}
      disabled={isDisabled}
    >
      {({ open, disabled }) => (
        <div className="relative overflow-visible font-normal h-full w-56 max-w-56">
          <Listbox.Button
            as="div"
            className={clsx(
              'h-full border border-gray-200 relative w-full rounded-md pl-2 pr-10 text-left text-gray-500 sm:text-xs flex items-center ',
              !isDisabled ? 'hover:bg-gray-100 cursor-pointer' : 'select-none'
            )}
          >
            <div className="flex gap-x-3 items-center font-mono overflow-hidden">
              {selectedOptionIcon && (
                <img
                  className="min-h-4 min-w-4 h-4 w-4 flex-none"
                  src={selectedOptionIcon}
                  alt=""
                />
              )}
              {selectedOption?.type === 'duckdb' && (
                <span className="text-[10px]">🐤</span>
              )}
              <span className="block truncate">{selectedOptionLabel}</span>
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
              className="mt-1 absolute z-10 max-h-60 w-full overflow-auto rounded-md bg-white text-base shadow-lg border border-gray-200 focus:outline-none sm:text-xs"
            >
              {options
                .slice(0, options.length - 1)
                .filter((o) => !o.isDemo)
                .map((option) => (
                  <DataSourceOption option={option} key={option.value} />
                ))}
              {options
                .slice(0, options.length - 1)
                .filter((o) => o.isDemo)
                .map((option) => (
                  <DataSourceOption option={option} key={option.value} />
                ))}
              <>
                {options.length > 1 && (
                  <hr className="border-t border-gray-200" />
                )}
                <DataSourceOption option={options[options.length - 1]} />
              </>
              {props.onAdd && (
                <>
                  <hr className="border-t border-gray-200" />
                  <button
                    onClick={props.onAdd}
                    className="flex items-center w-full text-left py-2 pl-3 pr-9 text-gray-900 hover:bg-primary-200 gap-x-3"
                  >
                    <PlusIcon className="h-3 w-3" aria-hidden="true" />
                    <span>{props.onAddLabel ?? ''}</span>
                  </button>
                </>
              )}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  )
}

function DataSourceOption({ option }: { option: Option }) {
  return (
    <Listbox.Option
      key={option.value}
      as="div"
      className={({ active }) =>
        clsx(
          active ? 'bg-primary-200' : '',
          'relative select-none pl-3 pr-9 text-gray-900 hover:cursor-pointer py-2'
        )
      }
      value={option.value}
    >
      {({ selected, active }) => (
        <div className="flex gap-x-3 items-center font-mono overflow-hidden">
          {option.type == 'duckdb' ? (
            <span className="text-[10px]">🐤</span>
          ) : (
            <img
              className="min-h-3 min-w-3 h-3 w-3 flex-none"
              src={databaseImages(option.type)}
              alt=""
            />
          )}
          <span
            className={clsx(
              selected ? 'font-semibold' : 'font-normal',
              'block truncate'
            )}
          >
            {option.label}
          </span>

          {selected && (
            <span
              className={clsx(
                active ? 'text-white' : 'text-primary-200',
                'absolute inset-y-0 right-0 flex items-center pr-4'
              )}
            >
              <CheckIcon className="text-gray-900 h-3 w-3" aria-hidden="true" />
            </span>
          )}
        </div>
      )}
    </Listbox.Option>
  )
}
