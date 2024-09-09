import { CpuChipIcon, Cog8ToothIcon } from '@heroicons/react/24/outline'
import React, { useEffect } from 'react'

import { useStringQuery } from '@/hooks/useQueryArgs'
import { useRouter } from 'next/router'
import Layout from '@/components/Layout'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Environments',
    icon: CpuChipIcon,
    href: `/workspaces/${workspaceId}/environments`,
    current: true,
  },
]

export default function EnvironmentsPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')

  useEffect(() => {
    router.push(`/workspaces/${workspaceId}/environments/current`)
  }, [workspaceId, router])

  return (
    <Layout pagePath={pagePath(workspaceId ?? '')}>
      <EnvironmentsPlaceholder />
    </Layout>
  )
}

function EnvironmentsPlaceholder() {
  return (
    <div className="py-6">
      <div className="text-center py-12 bg-ceramic-50/60 rounded-xl">
        <CpuChipIcon className="h-12 w-12 text-gray-400 mx-auto" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">
          Configurable environments are not available yet.
        </h3>
        <p className="mt-1 text-sm text-gray-500">
          We&apos;ll notify you when configurable environments are available.
        </p>
      </div>
    </div>
  )
}
