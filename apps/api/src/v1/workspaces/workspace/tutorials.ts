import { Router } from 'express'
import { IOServer } from '../../../websocket'
import { getParam } from '../../../utils/express.js'
import {
  advanceTutorial,
  dismissTutorial,
  getTutorialState,
} from '../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../websocket/workspace/tutorial.js'
import { logger } from '../../../logger.js'

export default function tutorialsRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.get('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    try {
      const tutorialState = await getTutorialState(workspaceId, tutorialType)

      if (!tutorialState) {
        res.status(404).end()
        return
      }

      res.json(tutorialState)
    } catch (err) {
      logger().error(
        { err, workspaceId, tutorialType },
        'Failed to get tutorial state'
      )
      res.status(500).end()
    }
  })

  router.post('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    try {
      const tutorialState = await advanceTutorial(
        workspaceId,
        tutorialType,
        null
      )

      if (!tutorialState) {
        res.status(404).end()
        return
      }

      res.json(tutorialState)
      broadcastTutorialStepStates(socketServer, workspaceId, tutorialType)
    } catch (err) {
      logger().error(
        { err, workspaceId, tutorialType },
        'Failed to dismiss tutorial'
      )
      res.status(500).end()
    }
  })

  router.post('/:tutorialType/dismiss', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    try {
      const tutorialState = await dismissTutorial(workspaceId, tutorialType)

      if (!tutorialState) {
        res.status(404).end()
        return
      }

      res.json(tutorialState)
      broadcastTutorialStepStates(socketServer, workspaceId, tutorialType)
    } catch (err) {
      logger().error(
        { err, workspaceId, tutorialType },
        'Failed to dismiss tutorial'
      )
      res.status(500).end()
    }
  })

  return router
}
