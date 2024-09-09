import { useStringQuery } from '@/hooks/useQueryArgs'
import { SessionUser, useSession } from '@/hooks/useAuth'
import PrivateDocumentPage from '@/components/PrivateDocumentPage'
import useDocument from '@/hooks/useDocument'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import {
  ContentSkeleton,
  TitleSkeleton,
} from '@/components/v2Editor/ContentSkeleton'
import clsx from 'clsx'
import { widthClasses } from '@/components/v2Editor/constants'

export default function EditNotebookPage() {
  const session = useSession()
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')
  const router = useRouter()

  useEffect(() => {
    const role = session.data?.roles[workspaceId]
    if (!role && !session.isLoading) {
      router.replace(`/workspaces/${workspaceId}/documents/${documentId}`)
    }
  }, [session.data, workspaceId, documentId])

  if (!session.data || !session.data.roles[workspaceId]) {
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

  return (
    <EditNotebook
      workspaceId={workspaceId}
      documentId={documentId}
      user={session.data}
    />
  )
}

interface Props {
  workspaceId: string
  documentId: string
  user: SessionUser
}
function EditNotebook(props: Props) {
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
    }
  }, [document, loading, props.user])

  if (loading || !document) {
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

  return (
    <>
      <Head>
        <title>{document.title || 'Untitled'} - Briefer</title>
      </Head>
      <PrivateDocumentPage
        key={props.documentId}
        workspaceId={props.workspaceId}
        documentId={props.documentId}
        user={props.user}
        isApp={false}
      />
    </>
  )
}
