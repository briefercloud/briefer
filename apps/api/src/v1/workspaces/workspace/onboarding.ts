import prisma from '@briefer/database'
import { Router } from 'express'
import { getParam } from '../../../utils/express.js'
import z from 'zod'
import { OnboardingStep } from '@briefer/types'

const onboardingRouter = Router({ mergeParams: true })

const onboardingPayload = z.object({
  onboardingStep: OnboardingStep,
})

onboardingRouter.put('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const payload = onboardingPayload.safeParse(req.body)
  if (!payload.success) {
    res.status(400).end()
    return
  }

  const workspace = await prisma().workspace.update({
    where: { id: workspaceId },
    data: { onboardingStep: payload.data.onboardingStep },
  })

  res.json(workspace)
})

export default onboardingRouter
