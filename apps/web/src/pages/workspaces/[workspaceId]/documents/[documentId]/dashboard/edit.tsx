import { useSession } from '@/hooks/useAuth'
import useDocument from '@/hooks/useDocument'
import { useStringQuery } from '@/hooks/useQueryArgs'
import useSideBar from '@/hooks/useSideBar'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'

const Dashboard = dynamic(() => import('@/components/Dashboard'), {
  ssr: false,
})

export default function EditDashboardPage() {
  const {
    state: { isOpen: isSideBarOpen },
    api: sideBarApi,
  } = useSideBar()
  const [initialSidebarOpen] = useState(isSideBarOpen)
  useEffect(() => {
    sideBarApi.close()

    return () => {
      sideBarApi.open(initialSidebarOpen)
    }
  }, [initialSidebarOpen, sideBarApi])

  const session = useSession({ redirectToLogin: true })
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const [{ document, loading: documentLoading }] = useDocument(
    workspaceId,
    documentId
  )
  const [{ publishing }, { publish }] = useDocument(workspaceId, documentId)

  const loading = session.isLoading || documentLoading
  const user = session.data
  const role = user?.roles[workspaceId]

  const router = useRouter()
  useEffect(() => {
    if (loading) {
      return
    }

    if (!document) {
      router.replace(`/workspaces/${workspaceId}`)
      return
    }

    if (!role || role === 'viewer') {
      router.replace(
        `/workspaces/${workspaceId}/documents/${documentId}/dashboard`
      )
    }
  }, [document, workspaceId, role, loading])

  if (!document || !user || !role || role === 'viewer') {
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
        user={user}
        isEditing={true}
        publish={publish}
        publishing={publishing}
      />
    </>
  )
}
