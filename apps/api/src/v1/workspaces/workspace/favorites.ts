import { prisma } from '@briefer/database'
import { Router } from 'express'
import { getParam } from '../../../utils/express.js'

const favoritesRouter = Router({ mergeParams: true })

favoritesRouter.get('/', async (req, res) => {
  const favorites = await prisma().favorite.findMany({
    where: {
      userId: req.session.user.id,
      document: {
        workspaceId: getParam(req, 'workspaceId'),
        deletedAt: null,
      },
    },
    select: {
      documentId: true,
    },
  })

  res.json(favorites.map((f) => f.documentId))
})

export default favoritesRouter
