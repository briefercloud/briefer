import {
  BookOpenIcon,
  ClockIcon,
  CodeBracketSquareIcon,
  MapIcon,
} from '@heroicons/react/24/outline'
import { ArrowLeftIcon, ArrowRightIcon } from '@heroicons/react/20/solid'
import { Menu, Transition } from '@headlessui/react'
import {
  EllipsisHorizontalIcon,
  InboxArrowDownIcon,
  FolderIcon,
} from '@heroicons/react/24/outline'
import { ChatBubbleBottomCenterTextIcon } from '@heroicons/react/24/outline'

interface Props {
  onToggleSchedules: () => void
  onToggleSnapshots: () => void
  onToggleComments: () => void
  onToggleFullScreen?: () => void
  onToggleFiles?: () => void
  onToggleSchemaExplorer?: () => void
  onToggleShortcuts?: () => void
  onToggleReusableComponents?: () => void
  isViewer: boolean
  isDeleted: boolean
  isFullScreen: boolean
}
function EllipsisDropdown(props: Props) {
  return (
    <Menu as="div" className="relative h-full">
      <Menu.Button className="flex items-center rounded-sm px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 h-full bg-white">
        <EllipsisHorizontalIcon className="w-4 h-4" />
      </Menu.Button>
      <Transition
        as="div"
        className="absolute z-40 right-0"
        enter="transition-opacity duration-300"
        enterFrom="opacity-0"
        enterTo="opacity-100"
        leave="transition-opacity duration-300"
        leaveFrom="opacity-100"
        leaveTo="opacity-0"
      >
        <Menu.Items
          as="div"
          className="mt-1 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none font-sans divide-y divide-gray-200 w-52"
        >
          {props.onToggleFiles && (
            <MenuButton
              icon={<FolderIcon className="h-4 w-4" />}
              text="Files"
              onClick={props.onToggleFiles}
            />
          )}
          {!props.isViewer && !props.isDeleted && (
            <>
              <MenuButton
                icon={<ClockIcon className="h-4 w-4" />}
                text="Schedules"
                onClick={props.onToggleSchedules}
              />
              <MenuButton
                icon={<InboxArrowDownIcon className="h-4 w-4" />}
                text="Snapshots"
                onClick={props.onToggleSnapshots}
              />
            </>
          )}

          <MenuButton
            icon={<ChatBubbleBottomCenterTextIcon className="h-4 w-4" />}
            text="Comments"
            onClick={props.onToggleComments}
          />

          {props.onToggleSchemaExplorer && (
            <MenuButton
              icon={<BookOpenIcon className="h-4 w-4" />}
              text="Schema explorer"
              onClick={props.onToggleSchemaExplorer}
            />
          )}

          {props.onToggleFullScreen && (
            <MenuButton
              icon={
                <div className="flex items-center">
                  {props.isFullScreen ? (
                    <>
                      <ArrowRightIcon className="h-3 w-3" />
                      <ArrowLeftIcon className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      <ArrowLeftIcon className="h-3 w-3" />
                      <ArrowRightIcon className="h-3 w-3" />
                    </>
                  )}
                </div>
              }
              text={
                props.isFullScreen
                  ? 'Shrink horizontally'
                  : 'Stretch horizontally'
              }
              onClick={props.onToggleFullScreen}
            />
          )}

          {props.onToggleReusableComponents && (
            <MenuButton
              icon={<CodeBracketSquareIcon className="h-4 w-4" />}
              text="Reusable components"
              onClick={props.onToggleReusableComponents}
            />
          )}

          {props.onToggleShortcuts && (
            <MenuButton
              icon={<MapIcon className="h-4 w-4" />}
              text="Keyboard shortcuts"
              onClick={props.onToggleShortcuts}
            />
          )}
        </Menu.Items>
      </Transition>
    </Menu>
  )
}

interface MenuButtonProps {
  icon?: JSX.Element
  text: string
  onClick: () => void
}
function MenuButton(props: MenuButtonProps) {
  return (
    <Menu.Item
      as="button"
      onClick={props.onClick}
      type="button"
      className="w-full flex items-center rounded-sm px-4 py-2 text-gray-500 text-sm gap-x-2 hover:bg-gray-100"
    >
      <div className="flex justify-center w-6">{props.icon}</div>
      <span>{props.text}</span>
    </Menu.Item>
  )
}

export default EllipsisDropdown
