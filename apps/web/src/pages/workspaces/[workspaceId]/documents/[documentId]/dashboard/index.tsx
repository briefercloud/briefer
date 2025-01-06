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
  const session = useSession({ redirectToLogin: true })
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const router = useRouter()
  const [{ document, loading: loadingDocument }] = useDocument(
    workspaceId,
    documentId
  )

  const loading = session.isLoading || loadingDocument
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
        router.replace(
          `/workspaces/${workspaceId}/documents/${documentId}${location.search}`
        )
      } else {
        router.replace(
          `/workspaces/${workspaceId}/documents/${documentId}/dashboard/edit${location.search}`
        )
      }
    }
  }, [loading, document, role, router, workspaceId, documentId])

  if (!document || !role || !session.data) {
    return null
  }

  return (
    <>
      <Head>
        <title>{document.title || 'Untitled'} - Briefer</title>
      </Head>

      <Dashboard
        document={document}
        role={role}
        user={session.data}
        isEditing={false}
        publish={() => Promise.resolve()}
        publishing={false}
      />
    </>
  )
}
