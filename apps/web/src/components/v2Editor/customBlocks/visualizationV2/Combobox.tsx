import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CheckIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import { Transition } from '@headlessui/react'
import clsx from 'clsx'
import ReactDOM from 'react-dom'
import useDropdownPosition from '@/hooks/dropdownPosition'

interface Props<T> {
  label?: string | JSX.Element
  value: T | null
  options: T[]
  onChange: (value: T | null) => void
  search: (options: T[], query: string) => T[]
  getLabel: (value: T) => string
  icon: (value: T) => React.ReactNode
  placeholder: string
  fetchOptions?: (query: string) => Promise<T[]>
  loadingOptions?: boolean
  disabled?: boolean
}

export default function ComboboxV2<T>(props: Props<T>) {
  const [query, setQuery] = useState<null | string>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const inputContainerRef = useRef<HTMLDivElement>(null)

  const filteredColumns = useMemo(() => {
    return query === null || query === ''
      ? props.options
      : props.search(props.options, query)
  }, [query, props.options, props.search])

  useEffect(() => {
    if (filteredColumns.length < 5 && props.fetchOptions) {
      props.fetchOptions(query ?? '')
    }
  }, [query, filteredColumns, props.fetchOptions])

  const menuRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const { onOpen, dropdownPosition } = useDropdownPosition(inputContainerRef)
  const onClickButton = useCallback(() => {
    if (!props.disabled) {
      setOpen(true)
      onOpen()
    }
  }, [props.disabled, onOpen])
  useEffect(() => {
    if (!open) {
      return
    }

    const onClickOutside = (e: MouseEvent) => {
      if (
        inputContainerRef.current &&
        !inputContainerRef.current.contains(e.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        e.preventDefault()
        e.stopImmediatePropagation()
        e.stopPropagation()
        setOpen(false)
      }
    }

    document.addEventListener('click', onClickOutside)
    return () => {
      document.removeEventListener('click', onClickOutside)
    }
  }, [inputContainerRef, menuRef, open])

  return (
    <div>
      {props.label && typeof props.label === 'string' ? (
        <div className="block text-xs font-medium leading-6 text-gray-900">
          {props.label}
        </div>
      ) : (
        props.label
      )}
      <div className="relative mt-1 mb-0.5" ref={inputContainerRef}>
        <div className="flex items-center space-x-1.5 rounded-md ring-1 ring-inset ring-gray-200 focus-within:ring-1 focus-within:ring-inset focus-within:ring-gray-300 bg-white group pl-2.5 pr-8 text-gray-800">
          {props.value && props.icon(props.value)}
          <input
            className={clsx(
              'w-full truncate border-0 text-xs pl-0.5 focus:ring-0 bg-transparent font-mono placeholder:text-gray-400',
              props.value === null && 'text-gray-400'
            )}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={props.placeholder}
            onClick={(e) => {
              if (!open) {
                e.preventDefault()
                buttonRef.current?.click()
              }
            }}
            onFocus={(e) => {
              if (!open) {
                e.preventDefault()
                buttonRef.current?.click()
                setQuery('')
              }
            }}
            onBlur={(e) => {
              e.preventDefault()
              setTimeout(() => setQuery(null), 200)
            }}
            value={query ?? (props.value ? props.getLabel(props.value) : '')}
          />
        </div>
        <button
          className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none"
          ref={buttonRef}
          onClick={onClickButton}
        >
          <ChevronUpDownIcon
            className="h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </button>

        {ReactDOM.createPortal(
          <Transition
            show={open}
            enter="transition duration-100 ease-out"
            enterFrom="transform scale-95 opacity-0"
            enterTo="transform scale-100 opacity-100"
            leave="transition duration-75 ease-out"
            leaveFrom="transform scale-100 opacity-100"
            leaveTo="transform scale-95 opacity-0"
            className="absolute z-[2000] text-xs -translate-x-1/2"
            style={{
              top: dropdownPosition.top,
              left: dropdownPosition.left,
              width: inputContainerRef.current?.getBoundingClientRect().width,
            }}
          >
            <div
              className="mt-1 max-h-56 overflow-auto rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none"
              ref={menuRef}
            >
              {filteredColumns.map((c, i) => (
                <button
                  key={i}
                  className="hover:text-white hover:bg-gray-50 text-gray-900 relative cursor-default select-none flex items-center gap-x-2 w-full cursor-pointer"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    props.onChange(c)
                    setOpen(false)
                  }}
                >
                  <div className="text-gray-900 flex w-full items-center justify-between pl-2 pr-4 py-2 hover:bg-gray-50">
                    <div className="flex items-center gap-x-2">
                      {props.icon(c)}
                      <span
                        className={clsx(
                          'truncate font-mono',
                          props.value === c && 'font-semibold'
                        )}
                      >
                        {props.getLabel(c)}
                      </span>
                    </div>

                    {props.value === c && (
                      <CheckIcon className="h-3 w-3" aria-hidden="true" />
                    )}
                  </div>
                </button>
              ))}
              {props.loadingOptions && (
                <div className="text-center text-gray-400 py-2">Loading...</div>
              )}
            </div>
          </Transition>,
          document.body
        )}
      </div>
    </div>
  )
}
