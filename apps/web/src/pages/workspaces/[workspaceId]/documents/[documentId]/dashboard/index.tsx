import DashboardSkeleton from '@/components/Dashboard/DashboardSkeleton'
import Layout from '@/components/Layout'
import { useSession } from '@/hooks/useAuth'
import useDocument from '@/hooks/useDocument'
import { useStringQuery } from '@/hooks/useQueryArgs'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
})

export default function DashboardPage() {
  const session = useSession()
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const [{ document, loading: loadingDocument }] = useDocument(
    workspaceId,
    documentId
  )

  const loading = session.isLoading || loadingDocument

  const router = useRouter()
  const role = session.data?.roles[workspaceId]
  useEffect(() => {
    if (loading) {
      return
    }

    if (!document) {
      router.replace(`/workspaces/${workspaceId}`)
      return
    }

    if (document.publishedAt === null) {
      if (!role || role === 'viewer') {
        // viewers can't see dashboard in edit mode
        router.replace(`/workspaces/${workspaceId}/documents/${documentId}`)
      } else {
        router.replace(
          `/workspaces/${workspaceId}/documents/${documentId}/dashboard/edit`
        )
      }
    }
  }, [document, workspaceId, role, loading])

  if (!document || !session.data || !role || !document.publishedAt) {
    return (
      <Layout>
        <DashboardSkeleton />
      </Layout>
    )
  }

  return (
    <>
      <Head>
        <title>{document.title || 'Untitled'} - Briefer</title>
      </Head>

      <Dashboard
        document={document}
        role={role}
        userId={session.data.id}
        isEditing={false}
        publish={() => Promise.resolve()}
        publishing={false}
      />
    </>
  )
}
