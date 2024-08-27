import { setIcon } from '@briefer/database'
import { Router } from 'express'
import { getParam } from '../../../../../utils/express.js'

const iconRouter = Router({ mergeParams: true })

iconRouter.post('/', async (req, res) => {
  try {
    await setIcon(getParam(req, 'documentId'), req.body.icon)
    res.status(204).end()
  } catch (error) {
    req.log.error({ err: error }, 'Error handling icon request')
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default iconRouter
