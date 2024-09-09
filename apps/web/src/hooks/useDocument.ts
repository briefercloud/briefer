import type { ApiDocument } from '@briefer/database'
import { useCallback, useMemo, useState } from 'react'
import { useDocuments } from './useDocuments'

type API = {
  setIcon: (icon: string) => Promise<void>
  publish: () => Promise<void>
}

type UseDocument = [
  {
    document: ApiDocument | null
    loading: boolean
    publishing: boolean
  },
  API,
]

function useDocument(workspaceId: string, documentId: string): UseDocument {
  const [{ documents, loading }, api] = useDocuments(workspaceId)
  const document = useMemo(
    () => documents.find((doc) => doc.id === documentId) ?? null,
    [documents, documentId]
  )

  const setIcon = useCallback(
    (icon: string) => api.setIcon(documentId, icon),
    [api, documentId]
  )

  const [publishing, setPublishing] = useState(false)
  const publish = useCallback(async () => {
    setPublishing(true)
    try {
      await api.publish(documentId)
    } catch (err) {
      alert('Failed to publish document')
    } finally {
      setPublishing(false)
    }
  }, [workspaceId, documentId, api.publish])

  return useMemo(
    () => [
      { document, loading, publishing },
      { setIcon, publish },
    ],
    [loading, setIcon, publish]
  )
}

export default useDocument
