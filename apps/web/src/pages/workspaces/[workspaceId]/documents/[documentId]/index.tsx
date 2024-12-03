import { useStringQuery } from '@/hooks/useQueryArgs'
import { SessionUser, useSession } from '@/hooks/useAuth'
import useDocument from '@/hooks/useDocument'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import { UserWorkspaceRole } from '@briefer/database'

export default function DocumentPage() {
  const session = useSession({ redirectToLogin: true })
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const role = session.data?.roles[workspaceId]
  const router = useRouter()

  useEffect(() => {
    if (!role && !session.isLoading) {
      // this user does not belong to this workspace
      router.replace('/')
    }
  }, [role, session.isLoading, workspaceId, router])

  if (session.data && role) {
    return (
      <PrivateDocumentPage
        workspaceId={workspaceId}
        documentId={documentId}
        user={session.data}
        role={role}
      />
    )
  }

  return null
}

interface PrivateDocumentPageProps {
  workspaceId: string
  documentId: string
  user: SessionUser
  role: UserWorkspaceRole
}
function PrivateDocumentPage(props: PrivateDocumentPageProps) {
  const [{ document, loading }] = useDocument(
    props.workspaceId,
    props.documentId
  )
  const router = useRouter()

  useEffect(() => {
    if (loading) {
      return
    }

    if (!document) {
      router.replace(`/workspaces/${props.workspaceId}`)
      return
    }

    if (document.publishedAt === null) {
      router.replace(
        `/workspaces/${props.workspaceId}/documents/${props.documentId}/notebook/edit`
      )
    }

    if (document.hasDashboard) {
      router.replace(
        `/workspaces/${props.workspaceId}/documents/${props.documentId}/dashboard`
      )
    } else {
      router.replace(
        `/workspaces/${props.workspaceId}/documents/${props.documentId}/notebook`
      )
    }
  }, [document, loading, props.workspaceId, props.documentId, props.user])

  return null
}
