import { Router } from 'express'

import dataSourcesRouter from './data-sources/index.js'
import documentsRouter from './documents/index.js'
import usersRouter from './users/index.js'
import favoritesRouter from './favorites.js'
import environmentVariablesRouter from './environment-variables.js'
import { IOServer } from '../../../websocket/index.js'
import { getParam } from '../../../utils/express.js'
import { broadcastDocuments } from '../../../websocket/workspace/documents.js'
import { UserWorkspaceRole, updateWorkspace } from '@briefer/database'
import onboardingRouter from './onboarding.js'
import filesRouter from './files.js'
import { canUpdateWorkspace, hasWorkspaceRoles } from '../../../auth/token.js'
import { WorkspaceEditFormValues } from '@briefer/types'
import { encrypt } from '@briefer/database'
import { config } from '../../../config/index.js'

const isAdmin = hasWorkspaceRoles([UserWorkspaceRole.admin])

export default function workspaceRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  let mutationsInProgress = new Map<string, number>()
  router.use((req, res, next) => {
    const workspaceId = getParam(req, 'workspaceId')
    const isMutation =
      req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE'
    if (!isMutation) {
      next()
      return
    }

    mutationsInProgress.set(
      workspaceId,
      (mutationsInProgress.get(workspaceId) ?? 0) + 1
    )
    res.on('finish', async () => {
      const counter = (mutationsInProgress.get(workspaceId) ?? 1) - 1
      if (counter <= 0) {
        try {
          await broadcastDocuments(socketServer, workspaceId)
        } catch (err) {
          req.log.error(
            { err },
            'Error emitting documents after workspace request'
          )
        }
      }

      mutationsInProgress.set(workspaceId, Math.max(0, counter))
    })

    next()
  })

  router.put('/', isAdmin, async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const payload = WorkspaceEditFormValues.safeParse(req.body)
    if (!payload.success) {
      res.status(400).end()
      return
    }

    if (payload.data.openAiApiKey) {
      const key = payload.data.openAiApiKey
      delete payload.data.openAiApiKey
      payload.data.openAiApiKey = encrypt(
        key,
        config().WORKSPACE_SECRETS_ENCRYPTION_KEY
      )
    }

    const updatedWorkspace = await updateWorkspace(workspaceId, payload.data)
    res.status(200).json(updatedWorkspace)
  })

  router.use('/onboarding', onboardingRouter)
  router.use('/data-sources', dataSourcesRouter)
  router.use('/documents', documentsRouter(socketServer))
  router.use('/users', usersRouter)
  router.use('/favorites', favoritesRouter)
  router.use(
    '/environment-variables',
    canUpdateWorkspace,
    environmentVariablesRouter
  )
  router.use('/files', canUpdateWorkspace, filesRouter)

  return router
}
