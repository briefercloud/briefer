import { z } from 'zod'
import { IOServer, Socket } from '../index.js'
import { prisma } from '@briefer/database'
import { Session } from '../../types.js'

import { Comment, uuidSchema } from '@briefer/types'
import { isAuthorizedForDocument } from '../../auth/token.js'
import { logger } from '../../logger.js'

export function fetchDocumentComments(socket: Socket, session: Session) {
  return async (data: unknown) => {
    const payload = z.object({ documentId: uuidSchema }).safeParse(data)
    if (!payload.success) {
      return
    }

    try {
      const doc = await isAuthorizedForDocument(
        payload.data.documentId,
        session.user.id
      )
      if (!doc) {
        return
      }

      const comments = await prisma().comment.findMany({
        where: { documentId: payload.data.documentId },
        include: { user: { select: { name: true, picture: true } } },
        orderBy: { createdAt: 'asc' },
      })

      socket.emit('document-comments', {
        documentId: payload.data.documentId,
        comments: comments.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      })
    } catch (err) {
      logger().error(
        {
          err,
          userId: session.user.id,
          documentId: payload.data.documentId,
        },
        'Error fetching document comments'
      )
    }
  }
}

export function broadcastComment(
  io: IOServer,
  workspaceId: string,
  documentId: string,
  comment: Comment
) {
  io.to(workspaceId).emit('document-comment', {
    documentId,
    comment,
  })
}

export function broadcastCommentDeleted(
  io: IOServer,
  workspaceId: string,
  documentId: string,
  commentId: string
) {
  io.to(workspaceId).emit('document-comment-deleted', {
    documentId,
    commentId,
  })
}
