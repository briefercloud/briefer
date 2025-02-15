import {
  UserWorkspaceRole,
  addUserToWorkspace,
  createUser,
  getUserByEmail,
  getWorkspaceById,
  listWorkspaceUsers,
} from '@briefer/database'
import { z } from 'zod'
import { getParam } from '../../../../utils/express.js'
import { NextFunction, Router, Request, Response } from 'express'
import userRouter from './user.js'
import { validate } from 'uuid'
import { generatePassword, hashPassword } from '../../../../password.js'
import { hasWorkspaceRoles } from '../../../../auth/token.js'
import { isUserNameValid } from '../../../../utils/validation.js'
import * as posthog from '../../../../events/posthog.js'
import { advanceTutorial } from '../../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../../websocket/workspace/tutorial.js'
import { IOServer } from '../../../../websocket/index.js'

const userSchema = z.object({
  name: z.string(),
  email: z.string(),
  role: z.enum([
    UserWorkspaceRole.admin,
    UserWorkspaceRole.editor,
    UserWorkspaceRole.viewer,
  ]),
})

const usersRouter = (socketServer: IOServer) => {
  const router = Router({ mergeParams: true })

  router.get('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    res.json(await listWorkspaceUsers(workspaceId))
  })

  const isAdmin = hasWorkspaceRoles([UserWorkspaceRole.admin])

  router.post('/', isAdmin, async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    try {
      const result = userSchema.safeParse(req.body)
      if (!result.success) {
        res.status(400).end()
        return
      }

      const email = result.data.email.trim()

      if (!isUserNameValid(result.data.name)) {
        res.status(400).end()
        return
      }

      const workspace = await getWorkspaceById(workspaceId)
      if (!workspace) {
        res.status(404).end()
        return
      }

      const password = generatePassword(24)
      let invitee = await getUserByEmail(email)
      if (!invitee) {
        const passwordDigest = await hashPassword(password)
        invitee = await createUser(email, result.data.name, passwordDigest)
      }

      await addUserToWorkspace(invitee.id, workspaceId, result.data.role)
      posthog.captureUserCreated(invitee, workspace.id, workspace.name)

      res.json({
        ...invitee,
        password,
      })

      const tutorialState = await advanceTutorial(
        workspaceId,
        'onboarding',
        'inviteTeamMembers'
      )
      broadcastTutorialStepStates(socketServer, workspaceId, 'onboarding')

      if (tutorialState.prevStep && tutorialState.didAdvance) {
        posthog.captureOnboardingStep(
          req.session.user.id,
          workspaceId,
          tutorialState.prevStep,
          false
        )
      }
    } catch (err) {
      req.log.error({ err, workspaceId }, 'Error creating user')
      res.sendStatus(500)
    }
  })

  async function belongsToWorkspace(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const workspaceId = getParam(req, 'workspaceId')
    const userId = getParam(req, 'userId')

    if (!validate(userId) || !validate(workspaceId)) {
      res.status(400).end()
      return
    }

    const uw = req.session.userWorkspaces[workspaceId]
    if (!uw) {
      res.status(403).end()
      return
    }

    next()
  }

  function isAdminOrSelf(req: Request, res: Response, next: NextFunction) {
    const workspaceId = getParam(req, 'workspaceId')
    const role = req.session.userWorkspaces[workspaceId]?.role
    if (role === 'admin') {
      next()
      return
    }

    const userId = getParam(req, 'userId')
    if (userId === req.session.user.id) {
      next()
      return
    }

    res.status(403).end()
  }

  router.use('/:userId', isAdminOrSelf, belongsToWorkspace, userRouter)

  return router
}

export default usersRouter
