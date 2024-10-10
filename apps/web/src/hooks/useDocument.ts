import type { ApiDocument } from '@briefer/database'
import { useCallback, useMemo, useState } from 'react'
import { useDocuments } from './useDocuments'

type API = {
  setIcon: (icon: string) => Promise<void>
  publish: () => Promise<void>
  toggleRunUnexecutedBlocks: () => Promise<void>
}

type UseDocument = [
  {
    document: ApiDocument | null
    loading: boolean
    publishing: boolean
  },
  API
]

function useDocument(workspaceId: string, documentId: string): UseDocument {
  const [{ documents, loading }, api] = useDocuments(workspaceId)
  const document = useMemo(
    () => documents.find((doc) => doc.id === documentId) ?? null,
    [documents, documentId]
  )

  const currRunUnexecutedBlocks = document?.runUnexecutedBlocks ?? false

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

  const toggleRunUnexecutedBlocks = useCallback(async () => {
    const newRunUnexecutedBlocks = !currRunUnexecutedBlocks
    try {
      await api.updateDocumentSettings(documentId, {
        runUnexecutedBlocks: newRunUnexecutedBlocks,
      })
    } catch (err) {
      alert('Failed to update document settings')
    }
  }, [
    workspaceId,
    documentId,
    currRunUnexecutedBlocks,
    api.updateDocumentSettings,
  ])

  return useMemo(
    () => [
      { document, loading, publishing },
      { setIcon, publish, toggleRunUnexecutedBlocks },
    ],
    [loading, setIcon, publish, toggleRunUnexecutedBlocks]
  )
}

export default useDocument
