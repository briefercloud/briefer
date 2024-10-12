import { prisma } from '@briefer/database'
import { z } from 'zod'
import { Router } from 'express'
import { uuidSchema } from '@briefer/types'

import { getParam } from '../../../../../utils/express.js'
import { IOServer } from '../../../../../websocket/index.js'
import {
  broadcastComment,
  broadcastCommentDeleted,
} from '../../../../../websocket/workspace/comments.js'

export default function commentsRouter(io: IOServer) {
  const router = Router({ mergeParams: true })

  const newCommentSchema = z.object({
    id: uuidSchema,
    content: z.string().min(1),
  })

  router.post('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')
    const payload = newCommentSchema.safeParse(req.body)
    if (!payload.success) {
      res.status(400).end()
      return
    }

    try {
      const dbComment = await prisma().comment.create({
        data: {
          id: payload.data.id,
          content: payload.data.content,
          documentId: getParam(req, 'documentId'),
          userId: req.session.user.id,
        },
      })
      const comment = {
        ...dbComment,
        user: {
          name: req.session.user.name,
          picture: req.session.user.picture,
        },
        createdAt: dbComment.createdAt.toISOString(),
        updatedAt: dbComment.updatedAt.toISOString(),
      }
      res.status(201).json(comment)
      broadcastComment(io, workspaceId, documentId, comment)
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          documentId,
          err,
        },
        'Error creating comment'
      )
      res.sendStatus(500)
    }
  })

  router.delete('/:commentId', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')
    const commentId = getParam(req, 'commentId')

    try {
      const result = await prisma().comment.deleteMany({
        where: { id: commentId, userId: req.session.user.id },
      })
      res.status(204).end()
      if (result.count > 0) {
        broadcastCommentDeleted(io, workspaceId, documentId, commentId)
      }
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          documentId,
          commentId,
          err,
        },
        'Error deleting comment'
      )
      res.sendStatus(500)
    }
  })

  return router
}
