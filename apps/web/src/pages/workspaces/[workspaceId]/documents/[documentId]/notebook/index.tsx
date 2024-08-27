import { useStringQuery } from '@/hooks/useQueryArgs'
import { SessionUser, useSession } from '@/hooks/useAuth'
import PrivateDocumentPage from '@/components/PrivateDocumentPage'
import useDocument from '@/hooks/useDocument'
import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'
import Layout from '@/components/Layout'
import clsx from 'clsx'
import { widthClasses } from '@/components/v2Editor/constants'
import {
  ContentSkeleton,
  TitleSkeleton,
} from '@/components/v2Editor/ContentSkeleton'

export default function NotebookPage() {
  const session = useSession()
  const workspaceId = useStringQuery('workspaceId')
  const documentId = useStringQuery('documentId')

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

  if (session.data && session.data.roles[workspaceId]) {
    return (
      <Notebook
        workspaceId={workspaceId}
        documentId={documentId}
        user={session.data}
      />
    )
  }

  return null
}

interface Props {
  workspaceId: string
  documentId: string
  user: SessionUser
}
function Notebook(props: Props) {
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

  if (loading || !document || document.publishedAt === null) {
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
        isApp={true}
      />
    </>
  )
}
