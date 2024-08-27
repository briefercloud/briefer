import { Fragment, useCallback } from 'react'
import { Listbox, Transition } from '@headlessui/react'
import { PlusIcon, ChevronUpDownIcon } from '@heroicons/react/20/solid'
import type { Workspace } from '@briefer/database'
import clsx from 'clsx'

interface Props {
  current?: string
  workspaces: Workspace[]
  onChange: (id: string) => void
  onNew: () => void
}
export default function WorkspacesDropdown(props: Props) {
  const workspace = props.workspaces.find((w) => w.id === props.current)
  const onChange = useCallback(
    (id: string) => {
      if (id === '') {
        props.onNew()
      } else {
        props.onChange(id)
      }
    },
    [props.onChange, props.onNew]
  )

  return (
    <Listbox value={props.current} onChange={onChange}>
      {({ open }) => (
        <>
          <div className="relative mt-2">
            <Listbox.Button className="relative w-full rounded-sm py-1.5 pl-3 pr-10 text-left text-gray-900 sm:text-sm sm:leading-6 hover:bg-ceramic-100/80">
              <span className="block truncate">{workspace?.name}</span>
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
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-sm bg-white py-1 text-base shadow-lg sm:text-sm cursor-pointer">
                {props.workspaces.map((workspace) => (
                  <Listbox.Option
                    key={workspace.id}
                    className={({ selected, active }) =>
                      clsx(
                        active
                          ? 'bg-gray-100/80 text-gray-900'
                          : selected
                          ? 'bg-gray-100/40 text-gray-700'
                          : '',
                        'relative select-none py-2 pl-3 pr-9'
                      )
                    }
                    value={workspace.id}
                  >
                    <span className="block truncate">{workspace.name}</span>
                  </Listbox.Option>
                ))}

                <div className="h-0.5 bg-gray-100/80 my-1 w-full" />

                <Listbox.Option
                  className={({ active }) =>
                    clsx(
                      active && 'bg-gray-100/80 text-gray-900',
                      'relative select-none py-2 pl-3 pr-9'
                    )
                  }
                  value=""
                >
                  <span className={clsx('block truncate')}>
                    Create Workspace
                  </span>
                  <span className="absolute inset-y-0 right-0 flex items-center pr-4">
                    <PlusIcon className="h-5 w-5" aria-hidden="true" />
                  </span>
                </Listbox.Option>
              </Listbox.Options>
            </Transition>
          </div>
        </>
      )}
    </Listbox>
  )
}
