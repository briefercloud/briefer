import { Router } from 'express'
import { IOServer } from '../../../websocket'
import { getParam } from '../../../utils/express.js'
import prisma from '@briefer/database'
import { OnboardingTutorialStep } from '@briefer/types'
import { z } from 'zod'

const TutorialUpdatePayload = z.object({
  currentStep: OnboardingTutorialStep,
  isComplete: z.boolean().optional(),
})

export default function tutorialsRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.get('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    const tutorial = await prisma().onboardingTutorial.findUnique({
      where: {
        workspaceId,
      },
    })

    if (!tutorial) {
      res.status(404).end()
      return
    }

    res.json(tutorial)
  })

  router.post('/:tutorialType', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const tutorialType = getParam(req, 'tutorialType')

    if (tutorialType !== 'onboarding') {
      res.sendStatus(400)
      return
    }

    const payload = TutorialUpdatePayload.safeParse(req.body)
    if (!payload.success) {
      res.sendStatus(400)
      return
    }

    const tutorial = await prisma().onboardingTutorial.update({
      where: {
        workspaceId,
      },
      data: {
        currentStep: payload.data.currentStep,
        isComplete: payload.data.isComplete,
      },
    })

    res.json(tutorial)
  })

  return router
}
