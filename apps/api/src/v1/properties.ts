import { Response } from 'express'
import { Properties } from '@briefer/types'
import { Router } from 'express'
import properties from '../properties.js'

const propertiesRouter = Router({ mergeParams: true })

propertiesRouter.get('/', async (req, res: Response<Properties>) => {
  try {
    res.json(await properties())
  } catch (err) {
    req.log.error({ err }, 'Failed to handle properties request')
    res.sendStatus(500)
  }
})

export default propertiesRouter
