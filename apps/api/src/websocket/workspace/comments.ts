import { z } from 'zod'
import { getDocumentRoomId, IOServer, Socket } from '../index.js'
import { prisma } from '@briefer/database'
import { Session } from '../../types.js'

import { CommentAck, Comment } from '@briefer/types'

const DEFAULT_WORKSPACE_COMMENT_ERROR_MSG = 'Something went wrong'

const Payload = z.object({
  documentId: z.string(),
  content: z.string().min(1),
})

const onComment =
  (io: IOServer, socket: Socket, session: Session) =>
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
      // save to db
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

      // ack to the user
      callback?.(getCallbackSuccessResponse())

      // broadcast to all users in the document room
      broadcastComment(io, documentId, response)
    } catch (e) {
      callback?.(getCallbackErrorResponse())
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

const broadcastComment = (
  io: IOServer,
  documentId: string,
  comment: Comment
) => {
  io.to(getDocumentRoomId(documentId)).emit('workspace-comment', comment)
}

export { onComment }
