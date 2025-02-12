import { computeMenuPosition } from '@/utils/dom'
import { Menu, Transition } from '@headlessui/react'
import { CheckIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useRef } from 'react'
import { createPortal } from 'react-dom'

interface Props<T> {
  options: T[]
  value: T[]
  getLabel: (t: T) => string
  getIcon: ((t: T) => JSX.Element) | null
  onToggle: (value: T) => void
  placeholder: string
}
export default function MultiSelect<T>(props: Props<T>) {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuContainerRef = useRef<HTMLDivElement>(null)

  return (
    <Menu as="div">
      {({ open }) => {
        const portalStyle = computeMenuPosition(
          buttonRef,
          menuContainerRef,
          'bottom',
          6
        )
        portalStyle.width = buttonRef.current?.offsetWidth

        return (
          <>
            <Menu.Button
              ref={buttonRef}
              className={clsx(
                'flex items-center justify-between w-full rounded-md border-0 px-3 text-gray-900 shadow-sm text-xs text-left bg-white py-2',
                open
                  ? 'ring-2 ring-inset ring-ceramic-200/70'
                  : 'ring-1 ring-inset ring-gray-300',
                props.value.length === 0 && 'h-[38px]'
              )}
            >
              {props.value.length > 0 ? (
                <div className="flex flex-wrap gap-x-1 gap-y-1">
                  {props.value.map((value, index) => (
                    <div
                      key={index}
                      className="bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded-sm flex items-center gap-x-1 text-xs text-gray-600"
                    >
                      <span>{props.getLabel(value)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                          props.onToggle(value)
                        }}
                        className="p-0.5 rounded-full hover:bg-red-100 hover:text-red-700 disabled:cursor-not-allowed disabled:hover:bg-gray-50 disabled:hover:text-gray-800"
                      >
                        <XMarkIcon className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-400">{props.placeholder}</span>
              )}
              <ChevronDownIcon className="w-4 h-4 text-gray-400" />
            </Menu.Button>
            {createPortal(
              <Transition
                as="div"
                className="absolute z-30"
                enter="transition-opacity duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="transition-opacity duration-300"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
                style={portalStyle}
                show={open}
              >
                <Menu.Items
                  as="div"
                  ref={menuContainerRef}
                  className="w-full rounded-md bg-white shadow-md ring-1 ring-gray-100 focus:outline-none font-sans flex flex-col text-xs text-gray-600 py-1.5"
                >
                  {props.options.map((option, index) => (
                    <Menu.Item
                      as="button"
                      key={index}
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        props.onToggle(option)
                      }}
                      className={clsx(
                        'w-full hover:bg-gray-100 w-full pl-3 pr-4 py-1.5 text-left flex gap-x-2 items-center justify-between whitespace-nowrap',
                        props.value.includes(option) ? 'font-medium' : ''
                      )}
                    >
                      <div className="flex items-center gap-x-1.5">
                        {props.getIcon?.(option)}
                        <span>{props.getLabel(option)}</span>
                      </div>
                      {props.value.includes(option) ? (
                        <CheckIcon className="w-4 h-4" aria-hidden="true" />
                      ) : null}
                    </Menu.Item>
                  ))}
                </Menu.Items>
              </Transition>,
              document.body
            )}
          </>
        )
      }}
    </Menu>
  )
}
