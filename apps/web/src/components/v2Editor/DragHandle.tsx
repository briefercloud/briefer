import useDropdownPosition from '@/hooks/dropdownPosition'
import { Menu, Transition } from '@headlessui/react'
import {
  ForwardIcon,
  MinusCircleIcon,
  XCircleIcon,
  RectangleStackIcon,
  FolderIcon,
  EyeSlashIcon,
  BarsArrowDownIcon,
} from '@heroicons/react/24/outline'
import clsx from 'clsx'
import { useRef } from 'react'
import { createPortal } from 'react-dom'

const DragHandle = ({
  isDragging,
  onRunBelowBlock,
  onRunAllTabs,
  onDeleteTab,
  onDeleteBlock,
  onDuplicateTab,
  onDuplicateBlock,
  onHideAllTabs,
  targetRef,
}: {
  isDragging: boolean
  onRunBelowBlock: () => void
  onRunAllTabs: (() => void) | null
  onDeleteTab: (() => void) | null
  onDeleteBlock: () => void
  onDuplicateTab: (() => void) | null
  onDuplicateBlock: () => void
  onHideAllTabs: () => void
  targetRef: React.RefObject<HTMLDivElement>
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null)
  const { onOpen, dropdownPosition, containerRef } = useDropdownPosition(
    buttonRef,
    'top',
    4
  )

  return (
    <Menu as="div" className=" inline-block text-left">
      {({ open }) => {
        return (
          <>
            <Menu.Button
              ref={buttonRef}
              onClick={onOpen}
              className="rounded-md hover:bg-gray-100 h-6 w-6 flex items-center justify-center"
            >
              <div
                className={clsx(
                  'h-5 w-5 text-gray-400/60 group-hover/wrapper:opacity-100  transition-opacity duration-200 ease-in-out flex items-center justify-center',
                  isDragging ? 'cursor-grabbing' : 'cursor-pointer',
                  open ? 'opacity-100' : 'opacity-0'
                )}
              >
                <svg
                  height="24"
                  viewBox="0 0 24 24"
                  width="24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="m0 0h24v24h-24z" fill="none" />
                  <path
                    fill="currentColor"
                    d="m11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                  />
                </svg>
              </div>
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
                style={{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                }}
              >
                <Menu.Items
                  as="div"
                  ref={containerRef}
                  className="absolute -translate-x-full z-30 rounded-md bg-white shadow-[0_4px_12px_#CFCFCF] ring-1 ring-gray-100 focus:outline-none font-sans divide-y divide-gray-200 flex flex-col text-xs text-gray-600"
                >
                  <div className="flex flex-col divide-y divide-gray-200">
                    <div className="py-0.5 px-0.5">
                      {onRunAllTabs && (
                        <Menu.Item
                          as="button"
                          onClick={onRunAllTabs}
                          className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                        >
                          <ForwardIcon className="h-4 w-4" />
                          <span>Run all tabs</span>
                        </Menu.Item>
                      )}

                      <Menu.Item
                        as="button"
                        onClick={onRunBelowBlock}
                        className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                      >
                        <BarsArrowDownIcon className="h-4 w-4" />
                        <span>Run onwards</span>
                      </Menu.Item>

                      {onRunAllTabs && (
                        <>
                          <Menu.Item
                            as="button"
                            onClick={onHideAllTabs}
                            className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                          >
                            <EyeSlashIcon className="h-4 w-4" />
                            <span>Hide all tabs</span>
                          </Menu.Item>
                        </>
                      )}
                    </div>

                    <div className="py-0.5 px-0.5">
                      {onDuplicateTab && (
                        <Menu.Item
                          as="button"
                          className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                          onClick={onDuplicateTab}
                        >
                          <FolderIcon className="h-4 w-4" />
                          <span>Duplicate tab</span>
                        </Menu.Item>
                      )}
                      <Menu.Item
                        as="button"
                        onClick={onDuplicateBlock}
                        className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                      >
                        <RectangleStackIcon className="h-4 w-4" />
                        <span>Duplicate block</span>
                      </Menu.Item>
                    </div>
                    <div className="py-0.5 px-0.5">
                      {onDeleteTab && (
                        <Menu.Item
                          as="button"
                          className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                          onClick={onDeleteTab}
                        >
                          <MinusCircleIcon className="h-4 w-4" />
                          <span>Delete tab</span>
                        </Menu.Item>
                      )}
                      <Menu.Item
                        as="button"
                        onClick={onDeleteBlock}
                        className="hover:bg-gray-100 w-full px-2 py-1.5 rounded-md text-left flex gap-x-2 items-center whitespace-nowrap"
                      >
                        <XCircleIcon className="h-4 w-4" />
                        <span>Delete block</span>
                      </Menu.Item>
                    </div>
                  </div>
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

export default DragHandle
