import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import {
  CircleStackIcon,
  Cog8ToothIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import BigQueryForm, {
  BigQueryDataSourceInput,
} from '@/components/forms/bigquery'
import { useCallback } from 'react'
import { useNewDataSource } from '@/hooks/useDatasource'
import { useStringQuery } from '@/hooks/useQueryArgs'
import ScrollBar from '@/components/ScrollBar'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Data sources',
    icon: CircleStackIcon,
    href: `/workspaces/${workspaceId}/data-sources`,
    current: false,
  },
  {
    name: 'Add PostgreSQL data source',
    icon: PlusCircleIcon,
    href: '#',
    current: true,
  },
]

export default function NewDataSourcePostgresSQLPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')

  const newDataSource = useNewDataSource(workspaceId)

  const onSubmit = useCallback(
    async (data: BigQueryDataSourceInput) => {
      try {
        const ds = await newDataSource(data, 'bigquery')
        if (ds.config.data.connStatus === 'offline') {
          router.push(
            `/workspaces/${workspaceId}/data-sources?offline=${ds.config.data.id}`
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
      <ScrollBar className="w-full overflow-auto">
        <BigQueryForm workspaceId={workspaceId} onSubmit={onSubmit} />
      </ScrollBar>
    </Layout>
  )
}
