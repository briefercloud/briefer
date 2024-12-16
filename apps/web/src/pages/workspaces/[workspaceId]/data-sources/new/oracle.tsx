import Layout from '@/components/Layout'
import { useRouter } from 'next/router'
import {
  CircleStackIcon,
  Cog8ToothIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import OracleForm, { OracleDataSourceInput } from '@/components/forms/oracle'
import { useCallback } from 'react'
import { useNewDataSource } from '@/hooks/useDatasource'
import { useStringQuery } from '@/hooks/useQueryArgs'
import ScrollBar from '@/components/ScrollBar'
import { useSession } from '@/hooks/useAuth'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Data sources',
    icon: CircleStackIcon,
    href: `/workspaces/${workspaceId}/data-sources`,
    current: false,
  },
  {
    name: 'Add Oracle data source',
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
    async (data: OracleDataSourceInput) => {
      try {
        const ds = await newDataSource(data, 'oracle')
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

  const session = useSession({ redirectToLogin: true })
  if (!session.data) {
    return null
  }

  return (
    <Layout pagePath={pagePath(workspaceId)} hideOnboarding user={session.data}>
      <ScrollBar className="w-full overflow-auto">
        <OracleForm workspaceId={workspaceId} onSubmit={onSubmit} />
      </ScrollBar>
    </Layout>
  )
}
