import { z } from 'zod'
import { IOServer, Socket } from '../index.js'
import { prisma } from '@briefer/database'
import { Session } from '../../types.js'

import { CommentAck, Comment } from '@briefer/types'

const DEFAULT_WORKSPACE_COMMENT_ERROR_MSG = 'Something went wrong'

const Payload = z.object({
  documentId: z.string(),
  content: z.string().min(1),
})

export const onComment =
  (io: IOServer, session: Session) =>
  async (data: unknown, callback?: Function) => {
    try {
      const parsedPyload = Payload.safeParse(data)
      if (!parsedPyload.success && callback) {
        callback(getCallbackErrorResponse('Invalid payload'))
        return
      }
      const { documentId, content } = parsedPyload.data as z.infer<
        typeof Payload
      >
      const comment = await prisma().comment.create({
        data: {
          content: content,
          documentId: documentId,
          userId: session.user.id,
        },
      })

      const response: Comment = {
        ...comment,
        user: { name: session.user.name, picture: session.user.picture },
      }

      callback?.(getCallbackSuccessResponse())
      broadcastComment(io, documentId, response)
    } catch (e) {
      callback?.(getCallbackErrorResponse())
    }
  }

export const joinWorkspaceDocument =
  (socket: Socket) => async (data: unknown, callback?: Function) => {
    try {
      const parsedData = z.object({ docId: z.string() }).safeParse(data)
      if (!parsedData.success) {
        callback && callback(getCallbackErrorResponse('Invalid payload'))
        return
      }
      const roomId = getDocumentRoomId(parsedData.data.docId)
      if (!socket.rooms.has(roomId)) {
        await socket.join(roomId)
      }
      await emitWorkspaceDocumentComments(socket, parsedData.data.docId)
      callback && callback(getCallbackSuccessResponse())
    } catch (e) {
      callback && callback(getCallbackErrorResponse('Internal server error'))
    }
  }

export const leaveWorkspaceDocument =
  (socket: Socket) => async (data: unknown, callback?: Function) => {
    try {
      const parsedData = z.object({ docId: z.string() }).safeParse(data)
      if (!parsedData.success) {
        callback && callback(getCallbackErrorResponse('Invalid payload'))
        return
      }
      const roomId = getDocumentRoomId(parsedData.data.docId)
      if (socket.rooms.has(roomId)) {
        await socket.leave(roomId)
      }
      callback && callback(getCallbackSuccessResponse())
    } catch (e) {
      callback && callback(getCallbackErrorResponse('Internal server error'))
    }
  }

const broadcastComment = (
  io: IOServer,
  documentId: string,
  comment: Comment
) => {
  io.to(getDocumentRoomId(documentId)).emit('workspace-comment', [comment])
}

const emitWorkspaceDocumentComments = async (
  socket: Socket,
  docId: string
) => {
  try {
    const comments: Comment[] = await prisma().comment.findMany({
      where: { documentId: docId },
      include: { user: { select: { name: true, picture: true } } },
      orderBy: { createdAt: 'asc' },
    })
    socket.emit('workspace-comment', comments)
  } catch (e) {
    throw e
  }
}

const getCallbackErrorResponse = (errorMsg?: string): CommentAck => {
  return {
    status: 'error',
    errorMsg: errorMsg ?? DEFAULT_WORKSPACE_COMMENT_ERROR_MSG,
  }
}

const getCallbackSuccessResponse = (): CommentAck => {
  return {
    status: 'success',
  }
}

const getDocumentRoomId = (doc_id: string) => {
  return `document-room-${doc_id}`
}
