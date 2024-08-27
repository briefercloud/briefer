import { Router } from 'express'
import queryRouter from './query/index.js'

const queriesRouter = Router({ mergeParams: true })

queriesRouter.use('/:queryId', queryRouter)

export default queriesRouter
