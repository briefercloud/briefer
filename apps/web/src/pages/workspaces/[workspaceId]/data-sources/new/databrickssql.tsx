import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import {
  CircleStackIcon,
  Cog8ToothIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import DatabricksSQLForm, { DatabricksSQLDataSourceInput } from '@/components/forms/databrickssql'
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
    name: 'Add Databricks SQL data source',
    icon: PlusCircleIcon,
    href: '#',
    current: true,
  },
]

export default function NewDataSourceDatabricksSQLPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')

  const newDataSource = useNewDataSource(workspaceId)

  const onSubmit = useCallback(
    async (data: DatabricksSQLDataSourceInput) => {
      try {
        const ds = await newDataSource(data, 'databrickssql')
        if (ds.config.data.connStatus === 'offline') {
          router.push(
            `/workspaces/${workspaceId}/data-sources?offline=${ds.config.data.id}`
          )
        } else {
          router.push(`/workspaces/${workspaceId}/data-sources`)
        }
      } catch (e: any) {
        alert(e.message || 'Something went wrong')
      }
    },
    [workspaceId]
  )

  return (
    <Layout pagePath={pagePath(workspaceId)} hideOnboarding>
      <div className="w-full overflow-scroll">
        <DatabricksSQLForm workspaceId={workspaceId} onSubmit={onSubmit} />
      </div>
    </Layout>
  )
}
