import { fromPairs } from 'ramda'
import { prisma, confirmUser, getUserByEmail, ApiUser } from '@briefer/database'
import { Router } from 'express'
import { z } from 'zod'
import { obscureEmail } from '../emails.js'
import { comparePassword, hashPassword, isValidPassword } from '../password.js'
import properties from '../properties.js'
import { IOServer } from '../websocket/index.js'
import { cookieOptions } from './index.js'
import {
  authenticationMiddleware,
  createAuthToken,
  createLoginLink,
  decodeLoginToken,
} from './token.js'
import { createWorkspace } from '../workspace/index.js'
import { isWorkspaceNameValid } from '../utils/validation.js'
import { captureWorkspaceCreated } from '../events/posthog.js'
import path from 'path'

function joinURL(base: string, ...parts: string[]) {
  try {
    const baseURL = new URL(base)
    return (
      baseURL.protocol +
      '//' +
      path.join(baseURL.host, baseURL.pathname, ...parts)
    )
  } catch {
    // base might not be a valid URL, so just join the parts
    return path.join(base, ...parts)
  }
}

type BaseAuthConfig = {
  FRONTEND_URL: string
}
export default function getRouter<H extends ApiUser>(
  socketServer: IOServer,
  config: BaseAuthConfig,
  transformUserSession?: (user: ApiUser) => H
) {
  const router = Router({ mergeParams: true })

  router.get('/link/callback', async (req, res) => {
    try {
      const query = z.object({ t: z.string().min(1) }).safeParse(req.query)
      if (!query.success) {
        res.status(400).end()
        return
      }

      const token = query.data.t
      const { data, isExpired } = decodeLoginToken(token)
      if (!data) {
        res.status(401).send('Invalid token')
        return
      }

      if (isExpired) {
        const redirect = joinURL(config.FRONTEND_URL, '/auth/expired-signin')
        res.redirect(redirect)
        return
      }

      await confirmUser(data.userId)

      res.cookie('token', createAuthToken(data.userId), cookieOptions)
      res.redirect(data.callback)
    } catch (err) {
      req.log.error({ err }, 'Failed to handle link callback request')
      res.sendStatus(500)
    }
  })

  router.post('/sign-up/password', async (req, res) => {
    try {
      const { needsSetup } = await properties()

      if (!needsSetup) {
        res.status(400).json({
          reason: 'setup-already-done',
        })
        return
      }

      const payload = z
        .object({
          workspaceName: z.string(),
          name: z.string().trim(),
          email: z.string().trim().email(),
          password: z.string(),
          shareEmail: z.boolean(),
          source: z.string().nullable(),
        })
        .safeParse(req.body)

      if (
        !payload.success ||
        !isWorkspaceNameValid(payload.data.workspaceName)
      ) {
        res.status(400).json({
          reason: 'invalid-payload',
        })
        return
      }

      const { email, password, shareEmail, source } = payload.data
      if (!isValidPassword(password)) {
        res.status(400).json({
          reason: 'invalid-password',
        })
        return
      }

      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        res.status(400).json({
          reason: 'user-exists',
        })
        return
      }

      const passwordDigest = await hashPassword(password)
      const { workspace, user } = await prisma().$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: payload.data.name,
            passwordDigest,
          },
        })

        const workspace = await createWorkspace(
          user,
          {
            name: payload.data.workspaceName,
          },
          socketServer,
          tx
        )

        return { workspace, user }
      })

      captureWorkspaceCreated(user, workspace, shareEmail, source)

      const loginLink = createLoginLink(user.id, config.FRONTEND_URL)

      res.status(201).json({ workspace, loginLink })
    } catch (err) {
      req.log.error({ err }, 'Failed to handle sign-up request')
      res.sendStatus(500)
    }
  })

  router.post('/sign-in/password', async (req, res) => {
    try {
      const payload = z
        .object({
          email: z.string().trim().email(),
          password: z.string(),
          callback: z.string().optional(),
        })
        .safeParse(req.body)
      if (!payload.success) {
        res.status(400).end()
        return
      }

      const { email, password, callback } = payload.data

      const user = await prisma().user.findUnique({
        where: { email },
        select: { id: true, email: true, passwordDigest: true },
      })
      if (!user || !user.passwordDigest) {
        res.status(400).end()
        return
      }

      const validPassword = await comparePassword({
        encrypted: user.passwordDigest,
        password,
      })
      if (!validPassword) {
        res.status(400).end()
        return
      }

      const redirect = callback
        ? joinURL(config.FRONTEND_URL, callback)
        : config.FRONTEND_URL
      const loginLink = createLoginLink(user.id, redirect)

      res.json({ email: obscureEmail(user.email), loginLink })
    } catch (err) {
      req.log.error({ err }, 'Failed to handle sign-in request')
      res.sendStatus(500)
    }
  })

  router.get('/session', authenticationMiddleware, async (req, res) => {
    try {
      const userWorkspaces = await prisma().userWorkspace.findMany({
        where: { userId: req.session.user.id },
      })

      const user = transformUserSession
        ? transformUserSession(req.session.user)
        : req.session.user

      res.json({
        ...user,
        roles: fromPairs(userWorkspaces.map((uw) => [uw.workspaceId, uw.role])),
      })
    } catch (err) {
      req.log.error({ err }, 'Failed to handle session request')
      res.sendStatus(500)
    }
  })

  router.get('/logout', async (req, res) => {
    try {
      res.clearCookie('token')
      res.redirect(config.FRONTEND_URL)
    } catch (err) {
      req.log.error({ err }, 'Failed to handle logout request')
      res.sendStatus(500)
    }
  })

  return router
}
