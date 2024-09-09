import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import {
  CircleStackIcon,
  Cog8ToothIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import RedshiftForm, {
  RedshiftDataSourceInput,
} from '@/components/forms/redshift'
import { useCallback } from 'react'
import { useNewDataSource } from '@/hooks/useDatasource'
import { useStringQuery } from '@/hooks/useQueryArgs'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Data sources',
    icon: CircleStackIcon,
    href: `/workspaces/${workspaceId}/data-sources`,
    current: false,
  },
  {
    name: 'Add Redshift data source',
    icon: PlusCircleIcon,
    href: '#',
    current: true,
  },
]

export default function NewDataSourceRedshiftPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')

  const newDataSource = useNewDataSource(workspaceId)

  const onSubmit = useCallback(
    async (data: RedshiftDataSourceInput) => {
      try {
        const ds = await newDataSource(data, 'redshift')
        if (ds.data.connStatus === 'offline') {
          router.push(
            `/workspaces/${workspaceId}/data-sources?offline=${ds.data.id}`
          )
        } else {
          router.push(`/workspaces/${workspaceId}/data-sources`)
        }
      } catch {
        alert('Something went wrong')
      }
    },
    [workspaceId]
  )

  return (
    <Layout pagePath={pagePath(workspaceId)} hideOnboarding>
      <div className="w-full overflow-scroll">
        <RedshiftForm workspaceId={workspaceId} onSubmit={onSubmit} />
      </div>
    </Layout>
  )
}
