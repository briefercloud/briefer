import { v4 as uuidv4 } from 'uuid'
import { Map } from 'immutable'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Comment } from '@briefer/types'
import useWebsocket from './useWebsocket'
import { useSession } from './useAuth'

type API = {
  createComment: (
    workspaceId: string,
    documentId: string,
    content: string
  ) => void
  deleteComment: (
    workspaceI: string,
    documentId: string,
    commentId: string
  ) => void
}
type State = Map<string, Comment[]>

const Context = createContext<[State, API]>([
  Map(),
  {
    createComment: () => {
      throw new Error(
        'Attempted to call createComment without CommentsProvider'
      )
    },
    deleteComment: () => {
      throw new Error(
        'Attempted to call deleteComment without CommentsProvider'
      )
    },
  },
])

type UseComments = [Comment[], API]
export function useComments(documentId: string): UseComments {
  const [state, api] = useContext(Context)
  const socket = useWebsocket()

  useEffect(() => {
    socket?.emit('fetch-document-comments', { documentId })
  }, [socket, documentId])

  return useMemo(
    (): UseComments => [state.get(documentId) ?? [], api],
    [state, api, documentId]
  )
}

interface Props {
  children: React.ReactNode
}
export function CommentsProvider(props: Props) {
  const [state, setState] = useState<State>(Map())
  const socket = useWebsocket()
  const session = useSession({ redirectToLogin: false })

  useEffect(() => {
    if (!socket) {
      return
    }

    const onComments = (data: { documentId: string; comments: Comment[] }) => {
      setState((state) => state.set(data.documentId, data.comments))
    }
    socket.on('document-comments', onComments)

    const onComment = (data: { documentId: string; comment: Comment }) => {
      setState((state) => {
        const comments = state.get(data.comment.documentId) ?? []

        if (comments.some(({ id }) => id === data.comment.id)) {
          return state
        }

        return state.set(data.comment.documentId, [...comments, data.comment])
      })
    }
    socket.on('document-comment', onComment)

    const onCommentDeleted = (data: {
      documentId: string
      commentId: string
    }) => {
      setState((state) => {
        const comments = state.get(data.documentId) ?? []
        return state.set(
          data.documentId,
          comments.filter((c) => c.id !== data.commentId)
        )
      })
    }
    socket.on('document-comment-deleted', onCommentDeleted)

    return () => {
      socket.off('document-comments', onComments)
      socket.off('document-comment-created', onComment)
      socket.off('document-comment-deleted', onCommentDeleted)
    }
  }, [socket])

  const createComment = useCallback(
    async (workspaceId: string, documentId: string, content: string) => {
      const user = session.data
      if (!user) {
        return
      }

      const now = new Date().toISOString()
      const comment: Comment = {
        user: {
          name: user.name,
          picture: user.picture,
        },
        id: uuidv4(),
        content,
        documentId,
        userId: user.id,
        createdAt: now,
        updatedAt: now,
      }

      setState((state) => {
        const comments = state.get(documentId) ?? []
        return state.set(documentId, [...comments, comment])
      })

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${documentId}/comments`,
        {
          credentials: 'include',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(comment),
        }
      )
      if (!res.ok) {
        alert('Failed to create comment')
        setState((state) => {
          const comments = state.get(documentId) ?? []
          return state.set(
            documentId,
            comments.filter((c) => c.id !== comment.id)
          )
        })
      }
    },
    [session]
  )

  const deleteComment = useCallback(
    async (workspaceId: string, documentId: string, commentId: string) => {
      const comment = state.get(documentId)?.find((c) => c.id === commentId)
      if (!comment) {
        return
      }

      setState((state) => {
        const comments = state.get(documentId) ?? []
        return state.set(
          documentId,
          comments.filter((c) => c.id !== commentId)
        )
      })
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${documentId}/comments/${commentId}`,
        {
          credentials: 'include',
          method: 'DELETE',
        }
      )
      if (!res.ok) {
        alert('Failed to delete comment')
        setState((state) => {
          const comments = state.get(documentId) ?? []
          return state.set(documentId, [...comments, comment])
        })
      }
    },
    []
  )

  const value: [State, API] = useMemo(
    () => [state, { createComment, deleteComment }],
    [state, createComment, deleteComment]
  )

  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
