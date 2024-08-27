import { Router } from 'express'
import workspacesRouter from './workspaces/index.js'
import { authenticationMiddleware } from '../auth/token.js'
import { IOServer } from '../websocket/index.js'
import propertiesRouter from './properties.js'

export default function v1Router(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.use(
    '/workspaces',
    authenticationMiddleware,
    workspacesRouter(socketServer)
  )

  router.use('/properties', propertiesRouter)

  return router
}
