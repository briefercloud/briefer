import { useStringQuery } from '@/hooks/useQueryArgs'
import { SessionUser, useSession } from '@/hooks/useAuth'
import useDocument from '@/hooks/useDocument'
import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/router'
import { ApiDocument, UserWorkspaceRole } from '@briefer/database'
import { useYDoc } from '@/hooks/useYDoc'
import { getDashboard } from '@briefer/editor'
import {
  ContentSkeleton,
  TitleSkeleton,
} from '@/components/v2Editor/ContentSkeleton'
import Layout from '@/components/Layout'
import clsx from 'clsx'
import { widthClasses } from '@/components/v2Editor/constants'

export default function DocumentPage() {
  const session = useSession()
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const role = session.data?.roles[workspaceId]
  const router = useRouter()

  useEffect(() => {
    if (!role && !session.isLoading) {
      router.replace(`/workspaces/${workspaceId}/documents`)
    }
  }, [role, session.isLoading, workspaceId, router])

  if (!session.data && session.isLoading && !session.error) {
    return (
      <Layout>
        <div className="w-full flex justify-center">
          <div className={clsx(widthClasses, 'py-20')}>
            <TitleSkeleton visible />
            <ContentSkeleton visible />
          </div>
        </div>
      </Layout>
    )
  }

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
  }, [document, loading, props.user])

  if (document && document.publishedAt) {
    return (
      <NotebookOrDashboard
        document={document}
        userId={props.user.id}
        role={props.role}
      />
    )
  }

  return (
    <Layout>
      <div className="w-full flex justify-center">
        <div className={clsx(widthClasses, 'py-20')}>
          <TitleSkeleton visible />
          <ContentSkeleton visible />
        </div>
      </div>
    </Layout>
  )
}

interface NotebookOrDashboardProps {
  document: ApiDocument
  userId: string
  role: UserWorkspaceRole
}
function NotebookOrDashboard(props: NotebookOrDashboardProps) {
  const clock = useMemo(
    () => props.document.userAppClock[props.userId] ?? props.document.appClock,
    [props.document.userAppClock, props.userId]
  )
  const { yDoc, syncing } = useYDoc(
    props.document.id,
    true,
    clock,
    props.userId,
    props.document.publishedAt,
    true,
    null
  )

  const router = useRouter()
  useEffect(() => {
    if (syncing) {
      return
    }

    const dashboard = getDashboard(yDoc)
    if (dashboard.size === 0) {
      router.replace(
        `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/notebook`
      )
    } else {
      router.replace(
        `/workspaces/${props.document.workspaceId}/documents/${props.document.id}/dashboard`
      )
    }
  }, [syncing, yDoc, router, props.document, props.role])

  return (
    <Layout>
      <div className="w-full flex justify-center">
        <div className={clsx(widthClasses, 'py-20')}>
          <TitleSkeleton visible />
          <ContentSkeleton visible />
        </div>
      </div>
    </Layout>
  )
}
