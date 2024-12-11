import { useDocuments } from '@/hooks/useDocuments'
import { useStringQuery } from '@/hooks/useQueryArgs'
import { useRouter } from 'next/router'
import { useEffect, useMemo } from 'react'

export default function DocumentsPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')
  const [state] = useDocuments(workspaceId)

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
  }, [state.loading, documents, workspaceId])

  return null
}
