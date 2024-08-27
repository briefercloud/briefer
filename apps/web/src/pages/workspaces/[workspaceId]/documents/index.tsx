import Layout from '@/components/Layout'
import {
  ContentSkeleton,
  TitleSkeleton,
} from '@/components/v2Editor/ContentSkeleton'
import { widthClasses } from '@/components/v2Editor/constants'
import { useDocuments } from '@/hooks/useDocuments'
import { useStringQuery } from '@/hooks/useQueryArgs'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { useEffect, useMemo } from 'react'

export default function DocumentsPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')
  const [state, { createDocument }] = useDocuments(workspaceId)

  const documents = useMemo(
    () =>
      state.documents.filter(
        (doc) => doc.deletedAt === null && doc.version > 1
      ),
    [state.documents]
  )

  useEffect(() => {
    const first = documents.first()
    if (!state.loading && first) {
      router.replace(`/workspaces/${workspaceId}/documents/${first.id}`)
    }
  }, [documents, workspaceId])

  useEffect(() => {
    if (!state.loading && documents.size === 0) {
      createDocument({ version: 2 })
    }
  }, [documents, state.loading, createDocument, workspaceId])

  return (
    <Layout>
      <div className="w-full flex justify-center">
        <div className={clsx(widthClasses, 'w-full py-20')}>
          <TitleSkeleton visible />
          <ContentSkeleton visible />
        </div>
      </div>
    </Layout>
  )
}
