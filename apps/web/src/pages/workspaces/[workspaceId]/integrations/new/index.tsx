import React from 'react'
import { PlusCircleIcon } from '@heroicons/react/20/solid'
import Layout from '@/components/Layout'
import { Cog8ToothIcon, PuzzlePieceIcon } from '@heroicons/react/24/outline'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { ChevronRightIcon } from '@heroicons/react/20/solid'
import { Tooltip } from '@/components/Tooltips'
import clsx from 'clsx'
import { useSession } from '@/hooks/useAuth'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Integrations',
    icon: PuzzlePieceIcon,
    href: `/workspaces/${workspaceId}/integrations`,
    current: false,
  },
  {
    name: 'Select integration type',
    icon: PlusCircleIcon,
    href: `/workspaces/${workspaceId}/integrations/new`,
    current: true,
  },
]

type IntegrationBlockProps = {
  name: string
  description: string
  icon: string
  onClick: () => void
  disabled?: boolean
}

function IntegrationBlock(props: IntegrationBlockProps) {
  return (
    <li className="relative py-5 hover:bg-gray-50 rounded-md w-full">
      <button
        onClick={props.onClick}
        className={clsx('w-full text-left', {
          'cursor-not-allowed': props.disabled,
        })}
        disabled={props.disabled}
      >
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="mx-auto flex justify-between gap-x-6">
            <div className="flex min-w-0 gap-x-4">
              <img
                className="h-12 w-12 flex-none"
                src={props.icon}
                alt="slack"
              />
              <div className="min-w-0 flex-auto">
                <p className="text-sm font-semibold leading-6 text-gray-900">
                  <span className="absolute inset-x-0 -top-px bottom-0" />
                  {props.name}
                </p>
                <p className="mt-1 flex text-xs leading-5 text-gray-500">
                  {props.description}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-x-4">
              <div className="hidden sm:flex sm:flex-col sm:items-end"></div>
              <ChevronRightIcon
                className="h-5 w-5 flex-none text-gray-400"
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </button>
    </li>
  )
}

export default function IntegrationsNewPage() {
  const session = useSession({ redirectToLogin: true })
  const workspaceId = useStringQuery('workspaceId') ?? ''

  if (!session.data) {
    return null
  }

  return (
    <Layout pagePath={pagePath(workspaceId)} user={session.data}>
      <div className="bg-white w-full h-full">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Select an integration
            </h3>
          </div>
          <ul role="list" className="divide-y divide-gray-100 pt-6">
            <Tooltip
              title="The Slack integration is not available in the open-source version"
              message="Upgrade to Briefer cloud’s professional tier to use it."
              className="flex w-full"
              active={true}
            >
              <IntegrationBlock
                name="Slack"
                description="Send reports or error notifications to a Slack channel. The Slack integration works with scheduled runs."
                icon="/icons/slack.png"
                onClick={() => {}}
                disabled
              />
            </Tooltip>
          </ul>
        </div>
      </div>
    </Layout>
  )
}
