import {
  Cog8ToothIcon,
  AdjustmentsHorizontalIcon,
  PencilIcon,
} from '@heroicons/react/24/outline'
import React, { useMemo, useState } from 'react'

import Layout from '@/components/Layout'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useSession } from '@/hooks/useAuth'
import type { ApiWorkspace } from '@briefer/database'
import clsx from 'clsx'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { useUsers } from '@/hooks/useUsers'
import { Switch } from '@headlessui/react'
import { PERSONAL_DOMAINS } from '@/utils/personalDomains'
import { Tooltip } from '@/components/Tooltips'
import {
  CheckCircleIcon,
  XMarkIcon,
  XCircleIcon,
} from '@heroicons/react/24/solid'
import useProperties from '@/hooks/useProperties'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Settings',
    icon: AdjustmentsHorizontalIcon,
    href: `/workspaces/${workspaceId}/settings`,
    current: true,
  },
]

// We declare this here to avoid importing the whole library from emails
export function getDomain(email: string): string {
  const parts = email.split('@').slice(1)
  return parts.join('')
}

export default function SettingsPage() {
  const workspaceId = useStringQuery('workspaceId')
  const session = useSession()
  const properties = useProperties()

  const [state, setState] = useState({
    isEditingName: false,
    isEditingOpenAIKey: false,
    newName: '',
    newOpenAIKey: '',
  })

  const isAdmin = session.data?.roles[workspaceId] === 'admin'
  const [workspaces, { updateSettings }] = useWorkspaces()
  const currentWorkspace: ApiWorkspace | undefined = useMemo(
    () => workspaces.data.find((w) => w.id === workspaceId),
    [workspaces.data, workspaceId]
  )

  const [users] = useUsers(workspaceId)
  const owner = useMemo(
    () => users.find((u) => u.id === currentWorkspace?.ownerId),
    [users, currentWorkspace]
  )

  const domain = getDomain(owner?.email ?? '')

  return (
    <Layout pagePath={pagePath(workspaceId ?? '')}>
      <div className="w-full bg-white h-full">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Workspace settings
            </h3>
          </div>

          <div>
            <div className="space-y-8 border-b border-gray-900/10 pb-0 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 ">
              <div className="flex items-center justify-between sm:gap-4 sm:py-6">
                <div className="flex flex-col gap-y-2 justify-left">
                  <label
                    htmlFor="workspace-name"
                    className="block text-md font-medium leading-6 text-gray-900 sm:pt-1.5"
                  >
                    Workspace name
                  </label>
                  <span className="text-xs text-gray-400">
                    This name appears on invites and will be displayed to you
                    and your team.
                  </span>
                </div>

                <div className="w-1/2 flex items-center justify-center">
                  {state.isEditingName ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        updateSettings(workspaceId, {
                          name: state.newName,
                        })
                        setState((s) => ({
                          ...s,
                          isEditingName: false,
                        }))
                      }}
                      className="flex gap-x-2 items-center"
                    >
                      <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-600 sm:max-w-md w-full">
                        <input
                          type="text"
                          name="workspaceName"
                          id="workspaceName"
                          className="block flex-1 border-0 bg-transparent px-2 py-1.5 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-md leading-6"
                          value={state.newName}
                          onChange={(e) =>
                            setState((s) => ({
                              ...s,
                              newName: e.target.value,
                            }))
                          }
                          placeholder="My company"
                        />
                      </div>

                      <button
                        type="button"
                        className="flex gap-x-2 items-center px-4 py-2 border border-gray-200 text-xs rounded-sm shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                        onClick={() =>
                          setState((s) => ({
                            ...s,
                            isEditingName: false,
                          }))
                        }
                      >
                        Cancel
                      </button>

                      <button
                        type="submit"
                        className="flex items-center justify-center px-4 py-2 border border-transparent text-xs rounded-sm shadow-sm text-hunter-950 bg-primary-200 hover:bg-primary-300"
                      >
                        Save
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-x-6">
                      <span className="text-lg">{currentWorkspace?.name}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          className="flex gap-x-1.5 items-center px-4 py-1.5 border border-gray-200 text-xs rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              newName: currentWorkspace?.name ?? '',
                              isEditingName: true,
                            }))
                          }
                        >
                          <PencilIcon className="h-3 w-3" />
                          Edit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {domain && !PERSONAL_DOMAINS.has(domain) && (
              <div className="space-y-8 border-b border-gray-900/10 pb-0 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 ">
                <div className="flex items-center justify-between sm:gap-4 sm:py-6">
                  <div className="flex flex-col gap-y-2 justify-left">
                    <label
                      htmlFor="workspace-name"
                      className="block text-md font-medium leading-6 text-gray-900 sm:pt-1.5"
                    >
                      Allow anyone at{' '}
                      <span className="underline">
                        @{getDomain(owner?.email ?? '')}
                      </span>{' '}
                      to join
                    </label>
                    <span className="text-xs text-gray-400">
                      All users with an {getDomain(owner?.email ?? '')} email
                      address will be able to join this workspace.
                    </span>
                  </div>

                  <div className="w-1/2 flex items-center justify-center">
                    <Switch.Group as="div">
                      <div className="mt-2">
                        <Tooltip
                          title="Allow anyone from domain to join is not available in the open-source version"
                          message="Upgrade to Briefer cloud’s professional tier to use this."
                          tooltipClassname="w-72 text-center"
                          active
                        >
                          <Switch
                            checked={false}
                            onChange={() => {}}
                            className={clsx(
                              'bg-gray-200',
                              'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed'
                            )}
                            disabled
                          >
                            <span
                              aria-hidden="true"
                              className={clsx(
                                'translate-x-0',
                                'pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out'
                              )}
                            />
                          </Switch>
                        </Tooltip>
                      </div>
                    </Switch.Group>
                  </div>
                </div>
              </div>
            )}

            {/* Model selection */}
            <div className="space-y-8 border-b border-gray-900/10 pb-0 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 ">
              <div className="flex items-center justify-between sm:gap-4 sm:py-6">
                <div className="flex flex-col gap-y-2 justify-left">
                  <label
                    htmlFor="assistant_model"
                    className="block text-md font-medium leading-6 text-gray-900 sm:pt-1.5"
                  >
                    Assistant model
                  </label>
                  <span className="text-xs text-gray-400">
                    Choose the model that will power your assistant.
                  </span>
                </div>

                <Tooltip
                  title="Different assistant models are not available in the open-source version"
                  message="Upgrade to Briefer cloud’s professional tier to have access to them."
                  tooltipClassname="w-72 text-center"
                  active
                  className="w-1/2 flex items-center justify-center"
                >
                  <select
                    id="assistant_model"
                    name="assistant_model"
                    className="block w-1/2 rounded-md border-0 py-1.5 pl-3 pr-10 text-gray-900 ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-primary-600 sm:text-sm sm:leading-6 disabled:bg-gray-100"
                    defaultValue="Select one"
                    value={currentWorkspace?.assistantModel}
                    onChange={(e) => {
                      updateSettings(workspaceId, {
                        assistantModel: e.target.value,
                      })
                    }}
                    disabled
                  >
                    <option value="gpt-4o">GPT-4o (Recommended)</option>
                  </select>
                </Tooltip>
              </div>
            </div>

            {!properties.data?.disableCustomOpenAiKey && (
              <div className="space-y-8 border-b border-gray-900/10 pb-0 sm:space-y-0 sm:divide-y sm:divide-gray-900/10 ">
                <div className="flex items-center justify-between sm:gap-4 sm:py-6">
                  <div className="flex flex-col gap-y-2 justify-left">
                    <label
                      htmlFor="assistant_model"
                      className="block text-md font-medium leading-6 text-gray-900 sm:pt-1.5"
                    >
                      OpenAI API Key
                    </label>
                    <span className="text-xs text-gray-400">
                      {`Enter your OpenAI API key to use AI features like "Edit with AI" and "Fix with AI".`}
                    </span>
                  </div>

                  <div className="w-1/2 flex justify-center gap-x-6">
                    {!state.isEditingOpenAIKey ? (
                      <>
                        <span className="flex gap-x-1 items-center justify-center text-sm">
                          {currentWorkspace?.secrets.hasOpenAiApiKey ? (
                            <>
                              <CheckCircleIcon
                                className="h-5 w-5 text-ceramic-300"
                                aria-hidden="true"
                              />
                              API key set.
                            </>
                          ) : (
                            <>
                              <XCircleIcon
                                className="h-5 w-5 text-red-500"
                                aria-hidden="true"
                              />
                              API key missing.
                            </>
                          )}
                        </span>

                        <div className="flex items-center justify-center gap-x-2">
                          <button
                            type="button"
                            className="flex gap-x-1.5 items-center px-4 py-1.5 border border-gray-200 text-xs rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                            onClick={() =>
                              setState((s) => ({
                                ...s,
                                newOpenAIKey: '',
                                isEditingOpenAIKey: true,
                              }))
                            }
                          >
                            <PencilIcon className="h-3 w-3" />
                            Edit
                          </button>

                          <button
                            type="button"
                            className={clsx(
                              'flex gap-x-1.5 items-center px-4 py-1.5 border border-gray-200 text-xs rounded-full shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none',
                              currentWorkspace?.secrets.hasOpenAiApiKey
                                ? 'block'
                                : 'hidden'
                            )}
                            onClick={() => {
                              updateSettings(workspaceId, {
                                openAiApiKey: '',
                              })
                              setState((s) => ({
                                ...s,
                                newOpenAIKey: '',
                                isEditingOpenAIKey: false,
                              }))
                            }}
                          >
                            <XMarkIcon className="h-3 w-3" />
                            Remove
                          </button>
                        </div>
                      </>
                    ) : (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault()
                          updateSettings(workspaceId, {
                            openAiApiKey: state.newOpenAIKey,
                          })
                          setState((s) => ({
                            ...s,
                            openAIKey: '',
                            isEditingOpenAIKey: false,
                          }))
                        }}
                        className="flex gap-x-2 items-center"
                      >
                        <div className="flex rounded-md shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-inset focus-within:ring-primary-600 sm:max-w-md w-full">
                          <input
                            type="text"
                            placeholder="Your OpenAI API key"
                            name="openAIKey"
                            id="openAIKey"
                            className="block flex-1 border-0 bg-transparent px-2 py-1.5 text-gray-900 placeholder:text-gray-400 focus:ring-0 text-md leading-6"
                            value={state.newOpenAIKey}
                            onChange={(e) =>
                              setState((s) => ({
                                ...s,
                                newOpenAIKey: e.target.value,
                              }))
                            }
                          />
                        </div>

                        <button
                          type="button"
                          className="flex gap-x-2 items-center px-4 py-2 border border-gray-200 text-xs rounded-sm shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                          onClick={() =>
                            setState((s) => ({
                              ...s,
                              isEditingOpenAIKey: false,
                            }))
                          }
                        >
                          Cancel
                        </button>

                        <button
                          type="submit"
                          className="flex items-center justify-center px-4 py-2 border border-transparent text-xs rounded-sm shadow-sm text-hunter-950 bg-primary-200 hover:bg-primary-300"
                        >
                          Save
                        </button>
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  )
}
