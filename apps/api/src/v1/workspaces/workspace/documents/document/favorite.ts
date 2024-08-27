import { createFavorite, deleteFavorite } from '@briefer/database'
import { Prisma } from '@prisma/client'
import { getParam } from '../../../../../utils/express.js'
import { Router } from 'express'

const favoriteRouter = Router({ mergeParams: true })

favoriteRouter.post('/', async (req, res) => {
  try {
    await createFavorite(req.session.user.id, getParam(req, 'documentId'))
    res.status(204).end()
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2003') {
        res.status(400).json({ error: 'User or document do not exist' })
        return
      }
    }

    throw err
  }
})

favoriteRouter.delete('/', async (req, res) => {
  await deleteFavorite(req.session.user.id, getParam(req, 'documentId'))
  res.status(204).end()
})

export default favoriteRouter
