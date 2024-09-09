import { prisma } from '@briefer/database'
import { z } from 'zod'

import { getParam } from '../../../../../utils/express.js'
import { Router } from 'express'

const commentsRouter = Router({ mergeParams: true })

const newCommentSchema = z.object({
  content: z.string().min(1),
})

commentsRouter.post('/', async (req, res) => {
  const result = newCommentSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).end()
    return
  }

  const { data } = result
  const comment = await prisma().comment.create({
    data: {
      ...data,
      documentId: getParam(req, 'documentId'),
      userId: req.session.user.id,
    },
  })
  res.status(201).json({
    ...comment,
    user: { name: req.session.user.name, picture: req.session.user.picture },
  })
})

commentsRouter.get('/', async (req, res) => {
  res.json(
    await prisma().comment.findMany({
      where: { documentId: getParam(req, 'documentId') },
      include: { user: { select: { name: true, picture: true } } },
      orderBy: { createdAt: 'asc' },
    })
  )
})

export default commentsRouter
