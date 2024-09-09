import { useCallback, useMemo, useRef } from 'react'
import { Fragment } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import useDropdownPosition from '@/hooks/dropdownPosition'
import ReactDOM from 'react-dom'

type Option = {
  name: string
  value: string | null
}
interface Props {
  label: string
  value: string | null
  options: Option[]
  onChange: (value: string | null) => void
  className?: string
  disabled?: boolean
}
function AxisModifierSelector(props: Props) {
  const onChange = useCallback(
    (v: string) => {
      if (v === 'None') {
        props.onChange(null)
        return
      }

      props.onChange(v)
    },
    [props.onChange]
  )

  const selected = useMemo(
    () => props.options.find((o) => o.value === props.value) ?? null,
    [props.options, props.value]
  )

  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef)

  const onClickButton = useCallback(() => {
    if (!props.disabled) {
      onOpen()
    }
  }, [props.disabled, onOpen])

  return (
    <Listbox
      value={props.value ?? 'None'}
      onChange={onChange}
      as="div"
      className={clsx(props.className, 'flex items-center justify-between')}
      disabled={props.disabled}
    >
      {({ open }) => (
        <>
          <Listbox.Label className="block text-xs leading-6 text-gray-500">
            {props.label}
          </Listbox.Label>
          <div className="relative">
            <Listbox.Button
              className="w-full cursor-pointer text-gray-500 text-xs leading-6 flex items-center justify-end gap-x-1"
              ref={buttonRef}
              onClick={onClickButton}
            >
              <span className="block truncate">{selected?.name ?? 'None'}</span>
              <span className="pointer-events-none flex items-center">
                <ChevronDownIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
              </span>
            </Listbox.Button>

            {ReactDOM.createPortal(
              <Transition
                show={open}
                leave="transition ease-in duration-100"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                style={{
                  position: 'absolute',
                  top: dropdownPosition.top,
                  right: dropdownPosition.right,
                }}
                className="z-[2000]"
              >
                <Listbox.Options className="min-w-24 max-w-44 mt-0.5 max-h-60 overflow-auto rounded-md bg-white py-2 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none bg-white">
                  {props.options.map((option, index) => (
                    <Listbox.Option
                      as="div"
                      key={index}
                      className={({ active }) =>
                        clsx(
                          active ? 'bg-gray-50' : '',
                          'relative cursor-default select-none py-2 text-xs flex items-center justify-between px-2.5'
                        )
                      }
                      value={option.value}
                      title={option.name}
                    >
                      {({ selected }) => (
                        <>
                          <span
                            className={clsx(
                              selected
                                ? 'font-semibold text-gray-800'
                                : 'font-normal text-gray-600',
                              'block truncate'
                            )}
                          >
                            {option.name}
                          </span>

                          {selected ? (
                            <CheckIcon
                              className="h-3 w-3 text-gray-600"
                              aria-hidden="true"
                            />
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </Transition>,
              document.body
            )}
          </div>
        </>
      )}
    </Listbox>
  )
}

export default AxisModifierSelector
