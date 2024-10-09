import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import { useCallback, useEffect, useMemo, useState } from 'react'
import useWebsocket from './useWebsocket'
import { Comment, CommentAck } from '@briefer/types'

type API = {
  createComment: (content: string, documentId: string) => void
  deleteComment: (id: string) => Promise<void>
}
type Error = string | null
type UseComments = [Comment[], Error, API]
export const useComments = (
  workspaceId: string,
  docId: string
): UseComments => {
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState<Error>(null)
  const socket = useWebsocket()

  useEffect(() => {
    socket?.emit("join-workspace-document", {docId}, (ack: CommentAck) => {
      if(ack.status === 'error'){
        setError("Failed to load comments")
      } 
    })

    socket?.on("workspace-comment", (comment: Comment[]) => {
      setComments((comments) => [...comments, ...comment])
    })

    return () => {
      socket?.emit("leave-workspace-document", {docId})
    }
  }, [workspaceId, docId])

  const createComment = useCallback((content: string) => {
      socket?.emit("workspace-comment", {documentId: docId, content: content}, (response : CommentAck) => {
        if(response.status === 'error') console.error(response.errorMsg)
      })
    },
    [comments, docId, workspaceId]
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

      setComments((comments) => comments.filter(comment => comment.id !== id))
    },
    [comments, workspaceId, docId]
  )

  return useMemo(
    () => [comments, error, { createComment, deleteComment }],
    [comments, error, createComment, deleteComment]
  )
}
