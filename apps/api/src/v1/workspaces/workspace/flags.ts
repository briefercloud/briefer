import { FeatureFlags } from '@briefer/types'
import { Router } from 'express'
import { config } from '../../../config/index.js'

const flagsRouter = Router({ mergeParams: true })

flagsRouter.get('/', async (_req, res) => {
  const flags: FeatureFlags = {
    visualizationsV2: config().FEATURE_FLAGS.visualizationsV2,
  }
  res.json(flags)
})

export default flagsRouter
