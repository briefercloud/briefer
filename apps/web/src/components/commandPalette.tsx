import { useDocuments } from '@/hooks/useDocuments'
import { Combobox, Dialog, Transition } from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import {
  DocumentPlusIcon,
  DocumentTextIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import * as allOutlineIcons from '@heroicons/react/24/outline'
import allLucideIcons from '@/utils/lucideIcons'
import { useRouter } from 'next/router'
import { ApiDocument } from '@briefer/database'
import { useDebounce } from '@/hooks/useDebounce'
import Fuse from 'fuse.js'
import clsx from 'clsx'

const icons: Record<string, React.ComponentType<React.ComponentProps<any>>> = {
  ...allOutlineIcons,
  ...allLucideIcons,
}

type CommandPaletteProps = {
  workspaceId: string
  isOpen: boolean
  setOpen: (open: boolean) => void
}

export default function CommandPalette(props: CommandPaletteProps) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [{ documents }] = useDocuments(props.workspaceId)

  const navigateToDocument = useCallback(
    (document: ApiDocument) => {
      const url = `/workspaces/${props.workspaceId}/documents/${document.id}`
      return router.push(url)
    },
    [router, props.workspaceId]
  )

  const fuse = useMemo(
    () =>
      new Fuse(
        documents.toArray().filter((d) => !d.deletedAt),
        {
          keys: ['title'],
          threshold: 0.3,
        }
      ),
    [documents]
  )

  const [searchState, setSearchState] = useState<{
    isSearching: boolean
    results: ApiDocument[]
  }>({ isSearching: false, results: [] })

  const debouncedSearch = useDebounce(
    (search: string) => {
      if (search === '') {
        setSearchState({
          isSearching: false,
          results: [],
        })
        return
      }

      const results = fuse.search(search)
      setSearchState({
        isSearching: false,
        results: results.map((r) => r.item),
      })
    },
    500,
    [fuse, setSearchState]
  )

  const onSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearchState((prev) => ({
        ...prev,
        isSearching: true,
      }))

      debouncedSearch(e.target.value)
      setQuery(e.target.value)
    },
    [setQuery, debouncedSearch]
  )

  return (
    <Transition show={props.isOpen}>
      <Dialog
        className="relative z-[1000]"
        onClose={() => {
          props.setOpen(false)
          setQuery('')
        }}
      >
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-25 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-[910] w-screen overflow-y-auto p-4 sm:p-6 md:p-20">
          <Transition.Child
            enter="ease-out duration-300"
            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            enterTo="opacity-100 translate-y-0 sm:scale-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
          >
            <Dialog.Panel className="mx-auto max-w-2xl transform divide-y divide-gray-100 overflow-hidden rounded-xl bg-white shadow-2xl ring-1 ring-black ring-opacity-5 transition-all">
              <Combobox
                onChange={(item: ApiDocument) => {
                  navigateToDocument(item)
                }}
              >
                {({ activeOption }) => (
                  <>
                    <div className="relative">
                      <MagnifyingGlassIcon
                        className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                        aria-hidden="true"
                      />
                      <Combobox.Input
                        autoFocus
                        className="h-12 w-full border-0 bg-transparent pl-11 pr-4 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
                        placeholder="Search..."
                        onChange={onSearchChange}
                      />
                    </div>

                    {searchState.results.length > 0 && (
                      <Combobox.Options
                        static
                        as="ul"
                        className="max-h-80 scroll-py-2 divide-y divide-gray-100 overflow-y-auto"
                      >
                        <li
                          className={clsx(
                            searchState.results.length > 0 ? 'p-2' : ''
                          )}
                        >
                          <ul className="text-sm text-gray-700">
                            {searchState.results.map((doc) => {
                              const IconElement = icons[doc.icon]

                              return (
                                <Combobox.Option
                                  as="li"
                                  key={doc.id}
                                  value={doc}
                                  className={clsx(
                                    'group flex cursor-default select-none items-center rounded-md px-3 py-2 data-[focus]:bg-gray-600 data-[focus]:text-white cursor-pointer',
                                    activeOption === doc && 'bg-gray-100'
                                  )}
                                  onClick={() => navigateToDocument(doc)}
                                >
                                  <IconElement
                                    className="h-6 w-6 flex-none text-gray-400 group-data-[focus]:text-white"
                                    aria-hidden="true"
                                  />
                                  <span className="ml-3 flex-auto truncate">
                                    {doc.title}
                                  </span>
                                  <span className="ml-3 hidden flex-none text-indigo-100 group-data-[focus]:inline">
                                    Jump to...
                                  </span>
                                </Combobox.Option>
                              )
                            })}
                          </ul>
                        </li>
                      </Combobox.Options>
                    )}

                    {query !== '' &&
                      !searchState.isSearching &&
                      searchState.results.length === 0 && (
                        <div className="px-6 py-14 text-center sm:px-14">
                          <FolderIcon
                            className="mx-auto h-6 w-6 text-gray-400"
                            aria-hidden="true"
                          />
                          <p className="mt-4 text-sm text-gray-900">
                            {
                              "We couldn't find any documents with that name. Please try again."
                            }
                          </p>
                        </div>
                      )}
                  </>
                )}
              </Combobox>
            </Dialog.Panel>
          </Transition.Child>
        </div>
      </Dialog>
    </Transition>
  )
}
