import { Router } from 'express'
import { prisma } from '@briefer/database'
import workspaceRouter from './workspace/index.js'
import { validate } from 'uuid'
import { IOServer } from '../../websocket/index.js'
import {
  WorkspaceCreateValues,
  createWorkspace,
} from '../../workspace/index.js'
import { getJupyterManager } from '../../jupyter/index.js'

export default function workspacesRouter(
  socketServer: IOServer,
) {
  const router = Router({ mergeParams: true })

  router.get('/', async (req, res) => {
    const userWorkspaces = await prisma().userWorkspace.findMany({
      where: { userId: req.session.user.id },
      select: { workspace: true },
      orderBy: { workspace: { name: 'asc' } },
    })

    res.json(userWorkspaces.map((uw) => uw.workspace))
  })

  router.post('/', async (req, res) => {
    const payload = WorkspaceCreateValues.safeParse(req.body)
    if (!payload.success) {
      res.status(400).end()
      return
    }

    try {
      const workspace = await createWorkspace(
        req.session.user,
        payload.data,
        socketServer,
      )
      res.status(201).json(workspace)
      try {
        await getJupyterManager().deploy(workspace)
      } catch (error) {
        req.log.error(
          { workspaceId: workspace.id, error },
          'Could not deploy Jupyter'
        )
      }
    } catch (error) {
      req.log.error({ error }, 'Could not create workspace')
      res.sendStatus(500)
    }
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
