import React from 'react'
import { PlusCircleIcon } from '@heroicons/react/20/solid'
import Layout from '@/components/Layout'
import { PuzzlePieceIcon, Cog8ToothIcon } from '@heroicons/react/24/outline'
import { useStringQuery } from '@/hooks/useQueryArgs'
import IntegrationsList from '@/components/IntegrationsList'
import Link from 'next/link'
import { useSession } from '@/hooks/useAuth'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Integrations',
    icon: PuzzlePieceIcon,
    href: `/workspaces/${workspaceId}/integrations`,
    current: true,
  },
]

export default function IntegrationsPage() {
  const session = useSession({ redirectToLogin: true })

  const workspaceId = useStringQuery('workspaceId')

  if (!session.data) {
    return null
  }

  return (
    <Layout pagePath={pagePath(workspaceId)} user={session.data}>
      <div className="bg-white w-full h-full">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Integrations
            </h3>
            <div className="flex">
              <Link
                href={`/workspaces/${workspaceId}/integrations/new`}
                className="flex items-center gap-x-2 rounded-lg bg-primary-200 px-3.5 py-2.5 text-sm font-semibold hover:bg-primary-300 border-stone-950 "
              >
                <PlusCircleIcon className="h-4 w-4" /> Add an integration
              </Link>
            </div>
          </div>

          <IntegrationsList workspaceId={workspaceId} />
        </div>
      </div>
    </Layout>
  )
}
