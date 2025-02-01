import { Router } from 'express'
import csvRouter from './csv.js'

const queryRouter = Router({ mergeParams: true })

queryRouter.use('/csv', csvRouter)

export default queryRouter
