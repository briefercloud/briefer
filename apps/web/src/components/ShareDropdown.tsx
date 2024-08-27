import copy from 'copy-to-clipboard'
import React, {
  useState,
  useEffect,
  useCallback,
  MouseEventHandler,
} from 'react'
import { LinkIcon } from '@heroicons/react/20/solid'
import { Menu, Switch, Transition } from '@headlessui/react'
import clsx from 'clsx'
import {
  DocumentArrowDownIcon,
  GlobeAltIcon,
  ShareIcon,
} from '@heroicons/react/24/outline'
import type { UserWorkspaceRole } from '@briefer/database'
import { Tooltip } from './Tooltips'

type Props = {
  workspaceId: string
  documentId: string
  documentTitle: string
  isPublic: boolean
  onTogglePublic: (() => void) | null
  link: string
  role: UserWorkspaceRole
  isDashboard: boolean
  isApp: boolean
}
export default function ShareDropdown(props: Props) {
  const [copied, setCopied] = useState(false)
  const onCopy: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.preventDefault()
      copy(props.link)
      setCopied(true)
    },
    [props.link, setCopied]
  )

  useEffect(() => {
    if (copied) {
      setTimeout(() => {
        setCopied(false)
      }, 1500)
    }
  }, [copied])

  return (
    <Menu as="div" className="relative inline-block text-left h-full">
      <Menu.Button className="flex items-center rounded-sm px-3 py-1 text-sm text-gray-500 hover:bg-gray-100 border border-gray-200 overflow-hidden group max-w-[42px] xl:max-w-[94px] hover:max-w-[94px] transition-mw duration-500 bg-white">
        <ShareIcon className="min-w-4 min-h-4" />
        <span className="ml-2 opacity-0 group-hover:opacity-100 xl:opacity-100 duration-500 transition-opacity">
          Share
        </span>
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
          className="w-60 xl:w-72 mt-1 rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none font-sans divide-y divide-gray-200"
        >
          {props.role !== 'viewer' && props.onTogglePublic && (
            <Menu.Item>
              {() => (
                <div className="px-4 py-3">
                  <Switch.Group
                    as="div"
                    className="flex items-center justify-between space-x-2 pb-2"
                  >
                    <Switch.Label
                      as="span"
                      className="text-sm leading-6 text-gray-900 flex items-center gap-x-2"
                      passive
                    >
                      <GlobeAltIcon className="w-4 h-4" />
                      Make public
                    </Switch.Label>

                    <Tooltip
                      title="Public documents are not available in the open-source version"
                      message="Upgrade to Briefer cloud’s professional tier to use them."
                      className="flex"
                      tooltipClassname="w-72 text-center"
                      position="bottom"
                      active
                    >
                      <Switch
                        checked={props.isPublic}
                        onChange={props.onTogglePublic ?? (() => {})}
                        className={clsx(
                          props.isPublic ? 'bg-primary-500' : 'bg-gray-200',
                          'relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none disabled:cursor-not-allowed'
                        )}
                        disabled
                      >
                        <span
                          aria-hidden="true"
                          className={clsx(
                            props.isPublic ? 'translate-x-4' : 'translate-x-0',
                            'pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                          )}
                        />
                      </Switch>
                    </Tooltip>
                  </Switch.Group>
                  <p className="text-xs text-gray-500">
                    Public documents are available to anyone with the link, but
                    code is not executable.
                  </p>
                </div>
              )}
            </Menu.Item>
          )}
          <Menu.Item>
            {({ active }) => (
              <button
                className={clsx(
                  active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                  'flex items-center gap-x-2 w-full text-sm px-4 py-3'
                )}
                onClick={onCopy}
              >
                {copied ? (
                  'Link copied!'
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" /> Copy link
                  </>
                )}
              </button>
            )}
          </Menu.Item>
          <Tooltip
            title="PDF exports are not available in the open-source version"
            message="Upgrade to Briefer cloud’s professional tier to use them."
            className="flex"
            tooltipClassname="w-72 text-center"
            position="bottom"
            active
          >
            <Menu.Item>
              {({ active }) => (
                <button
                  className={clsx(
                    'cursor-not-allowed',
                    active ? 'bg-gray-100 text-gray-900' : 'text-gray-700',
                    'flex items-center justify-between w-full text-sm px-4 py-3'
                  )}
                  disabled
                >
                  <div className="flex gap-x-2 items-center">
                    <DocumentArrowDownIcon className="w-4 h-4" />
                    Download as PDF
                  </div>
                </button>
              )}
            </Menu.Item>
          </Tooltip>
        </Menu.Items>
      </Transition>
    </Menu>
  )
}
