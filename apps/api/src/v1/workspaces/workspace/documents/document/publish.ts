import * as Y from 'yjs'
import { Router } from 'express'
import { getParam } from '../../../../../utils/express.js'
import { z } from 'zod'
import { IOServer } from '../../../../../websocket/index.js'
import prisma from '@briefer/database'
import { DashboardItem, setPristine } from '@briefer/editor'
import { DocumentPersistor } from '../../../../../yjs/v2/persistors.js'
import { getYDocWithoutHistory } from '../../../../../yjs/v2/documents.js'
import { getDocId, getYDocForUpdate } from '../../../../../yjs/v2/index.js'
import { broadcastDocument } from '../../../../../websocket/workspace/documents.js'
import { advanceTutorial } from '../../../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../../../websocket/workspace/tutorial.js'
import * as posthog from '../../../../../events/posthog.js'

export default function publishRouter(socketServer: IOServer) {
  const publishRouter = Router({ mergeParams: true })

  publishRouter.post('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')
    const body = z.record(DashboardItem).safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ reason: 'invalid-payload' })
      return
    }

    let hasDashboard = false
    try {
      const id = getDocId(documentId, null)
      await getYDocForUpdate(
        id,
        socketServer,
        documentId,
        workspaceId,
        async (yDoc) => {
          hasDashboard = yDoc.dashboard.size > 0
          await prisma().yjsAppDocument.create({
            data: {
              documentId,
              state: Buffer.from(
                Y.encodeStateAsUpdate(getYDocWithoutHistory(yDoc))
              ),
              hasDashboard,
            },
          })
          setPristine(yDoc.ydoc)
        },
        new DocumentPersistor(id, documentId)
      )

      await broadcastDocument(socketServer, workspaceId, documentId)

      res.sendStatus(204)

      const tutorialState = await advanceTutorial(
        workspaceId,
        'onboarding',
        'publishDashboard'
      )
      broadcastTutorialStepStates(socketServer, workspaceId, 'onboarding')

      if (tutorialState.prevStep && tutorialState.didAdvance) {
        posthog.captureOnboardingStep(
          req.session.user.id,
          workspaceId,
          'publishDashboard',
          false
        )
      }
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          documentId,
          err,
        },
        'Failed to publish document'
      )
      res.status(500).end()
    }
  })

  return publishRouter
}
