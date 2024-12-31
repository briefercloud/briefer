import { Router } from 'express'
import { IOServer } from '../../../websocket'
import { getParam } from '../../../utils/express.js'
import { advanceTutorial, getTutorialStepStates } from '../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../websocket/workspace/tutorial.js'

export default function tutorialsRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.get('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    const tutorialStepStates = await getTutorialStepStates(
      workspaceId,
      tutorialType
    )

    if (!tutorialStepStates) {
      res.status(404).end()
      return
    }

    res.json(tutorialStepStates)
  })

  // TODO this is temporary, for testing only
  router.post('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    const tutorialStepStates = await advanceTutorial(
      workspaceId,
      tutorialType,
      null
    )

    if (!tutorialStepStates) {
      res.status(404).end()
      return
    }

    res.json(tutorialStepStates)
    broadcastTutorialStepStates(socketServer, workspaceId, tutorialType)
  })

  return router
}
