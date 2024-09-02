import { Router } from 'express'
import { prisma } from '@briefer/database'
import workspaceRouter from './workspace/index.js'
import { validate } from 'uuid'
import { IOServer } from '../../websocket/index.js'

export default function workspacesRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.get('/', async (req, res) => {
    res.json(await getWorkspacesForUser(req.session.user.id))
  })

  router.use(
    '/:workspaceId',
    async (req, res, next) => {
      const workspaceId = req.params['workspaceId']?.toString()

      if (!workspaceId) {
        throw new Error('Expected to find workspaceId in query params')
      }

      if (!validate(workspaceId)) {
        res.status(404).end()
        return
      }

      const isAuthorized = req.session.userWorkspaces[workspaceId] !== undefined
      if (!isAuthorized) {
        res.status(403).end()
        return
      }

      next()
    },
    workspaceRouter(socketServer)
  )

  return router
}
