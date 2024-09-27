import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { useCallback, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import useWebsocket from './useWebsocket'
import { Comment, CommentAck } from '@briefer/types'

type API = {
  createComment: (content: string, documentId: string) => Promise<Comment>
  deleteComment: (id: string) => Promise<void>
}
type UseComments = [Comment[], API]
export const useComments = (
  workspaceId: string,
  docId: string
): UseComments => {

  const socket = useWebsocket()

  useEffect(() => {
    socket?.emit("join-workspace-document", docId)

    socket?.on("workspace-comment", (comment: Comment) => {
      console.log({comment})
    })

    return () => {
      socket?.emit("leave-workspace-document", docId)
    }
  }, [])

  const getWorkspaceDocumentRoomId = (docId: string) => {
    return `document-room-${docId}`
  }

  const { data, mutate } = useSWR<Comment[]>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${docId}/comments`,
    fetcher,
    { refreshInterval: 5000 }
  )

  const comments = useMemo(() => data ?? [], [data])

  const createComment = useCallback(
    async (content: string) => {
      
      socket?.emit("workspace-comment", {documentId: docId, content: content}, (response : CommentAck) => {
        console.log({response})
      })

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${docId}/comments`,
        {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        }
      )
      const comment: Comment = await res.json()

      mutate((comments ?? []).concat([comment]))

      return comment
    },
    [mutate, comments, docId, workspaceId]
  )

  const deleteComment = useCallback(
    async (id: string) => {
      await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${docId}/comments/${id}`,
        {
          credentials: 'include',
          method: 'DELETE',
        }
      )

      mutate(comments.filter((d) => d.id !== id))
    },
    [mutate, comments, workspaceId, docId]
  )

  return useMemo(
    () => [comments, { createComment, deleteComment }],
    [comments, createComment, deleteComment]
  )
}
