import { useCallback, useRef, useState } from 'react'
import { Menu, Transition } from '@headlessui/react'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import * as allOutlineIcons from '@heroicons/react/24/outline'
import Fuse from 'fuse.js'
import clsx from 'clsx'
import { useDebounce } from '@/hooks/useDebounce'
import useDocument from '@/hooks/useDocument'
import useDropdownPosition from '@/hooks/dropdownPosition'
import ReactDOM from 'react-dom'
import allLucideIcons from '@/utils/lucideIcons'
import { FixedSizeGrid as Grid } from 'react-window'

const icons: Record<string, React.ComponentType<React.ComponentProps<any>>> = {
  ...allOutlineIcons,
  ...allLucideIcons,
}

const fuse = new Fuse(Object.keys(icons), {
  threshold: 0.3,
})

interface Props {
  workspaceId: string
  documentId: string
  disabled: boolean
}

function IconSelector(props: Props) {
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const { onOpen, dropdownPosition } = useDropdownPosition(buttonRef, 'top')

  const [{ document: doc }, { setIcon }] = useDocument(
    props.workspaceId,
    props.documentId
  )
  const [filteredIcons, setFilteredIcons] = useState(Object.keys(icons))
  const Icon = icons[doc?.icon ?? 'DocumentIcon'] || (() => null)

  const debouncedSearch = useDebounce((search: string) => {
    if (search === '') {
      setFilteredIcons(Object.keys(icons))
      return
    }

    const results = fuse.search(search)
    setFilteredIcons(results.map((r) => r.item))
  }, 200)

  const onSearchChangeHandler: React.ChangeEventHandler<HTMLInputElement> =
    useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        e.preventDefault()
        const search = e.target.value
        debouncedSearch(search)
      },
      [debouncedSearch]
    )

  const onIconSelectHandler = useCallback(
    (icon: string, close: () => void) => {
      return (e: React.MouseEvent<HTMLButtonElement>) => {
        e.preventDefault()
        setIcon(icon)
        close()
      }
    },
    [setIcon]
  )

  // Prevent the default behavior only for the space key, otherwise
  // the keydown handler for the `Menu.Items` will close the menu
  const onSearchKeyDownHandler: React.KeyboardEventHandler<HTMLInputElement> =
    useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === ' ') {
        e.stopPropagation()
      }
    }, [])

  const resetFilteredIcons = useCallback(() => {
    setFilteredIcons(Object.keys(icons))
  }, [])

  const IconOption = ({ columnIndex, rowIndex, style }: any) => {
    const index = rowIndex * 11 + columnIndex
    const key = filteredIcons[index]
    const IconElement = icons[key]

    if (!IconElement) {
      return null
    }

    return (
      <Menu.Item key={key}>
        {({ active, close }) => (
          <button
            style={style}
            onClick={onIconSelectHandler(key, close)}
            className={clsx(
              active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
              'w-8 h-8 p-2 text-sm rounded-md'
            )}
          >
            <IconElement
              strokeWidth={1}
              className="h-4 w-4 shrink-0"
              aria-hidden="true"
            />
          </button>
        )}
      </Menu.Item>
    )
  }

  return (
    <Menu as="div" className="relative flex items-center">
      <Menu.Button
        as="div"
        ref={buttonRef}
        onClick={onOpen}
        className={clsx(
          {
            'hover:bg-ceramic-200': !props.disabled,
          },
          'flex items-center rounded-md p-0.5'
        )}
        disabled={props.disabled}
      >
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      </Menu.Button>

      {ReactDOM.createPortal(
        <Transition
          as={'div'}
          style={{
            position: 'absolute',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
          }}
          className="absolute z-[2000]"
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
          afterLeave={resetFilteredIcons}
        >
          <Menu.Items className="absolute -left-0.5 top-4 z-20 mt-2 w-96 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
            <div className="py-4 px-4">
              <div className="relative mt-2">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <MagnifyingGlassIcon
                    className="h-4 w-4 text-gray-400"
                    aria-hidden="true"
                  />
                </div>
                <input
                  type="text"
                  name="icon-search"
                  id="icon-search"
                  className="pl-8 shadow-sm focus:ring-primary-500 focus:border-primary-500 block w-full sm:text-sm border-gray-300 rounded-md placeholder-gray-400"
                  placeholder="Search icons"
                  onClick={(e) => e.stopPropagation()}
                  onChange={onSearchChangeHandler}
                  onKeyDown={onSearchKeyDownHandler}
                />
              </div>
              <div className="flex flex-wrap pt-4 w-full h-56 content-start">
                <Grid
                  columnCount={11}
                  columnWidth={32}
                  height={220}
                  rowCount={Math.ceil(filteredIcons.length / 11)}
                  rowHeight={32}
                  width={384}
                >
                  {IconOption}
                </Grid>
              </div>
            </div>
          </Menu.Items>
        </Transition>,
        document.body
      )}
    </Menu>
  )
}

export default IconSelector
