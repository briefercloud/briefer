import { fromPairs } from 'ramda'
import { prisma, confirmUser, getUserByEmail, ApiUser } from '@briefer/database'
import { Router } from 'express'
import { z } from 'zod'
import { obscureEmail } from '../emails.js'
import { comparePassword, hashPassword, isValidPassword } from '../password.js'
import properties from '../properties.js'
import { IOServer } from '../websocket/index.js'
import {
  callbackUrlSchema,
  cookieOptions,
  sessionExpiryCookieOption,
} from './index.js'
import {
  authenticationMiddleware,
  createAuthToken,
  createLoginLink,
  decodeLoginToken,
} from './token.js'
import { createWorkspace } from '../workspace/index.js'

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
      res.redirect(`${config.FRONTEND_URL}/auth/expired-signin?t=${token}`)
      return
    }

    await confirmUser(data.userId)

    res.cookie('token', createAuthToken(data.userId), cookieOptions)
    res.cookie('sessionExpiry', Date.now(), sessionExpiryCookieOption)
    res.redirect(data.callback)
  })

  router.post('/sign-up/password', async (req, res) => {
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
      })
      .safeParse(req.body)
    if (!payload.success) {
      res.status(400).json({
        reason: 'invalid-payload',
      })
      return
    }

    const { email, password } = payload.data
    if (!isValidPassword(password)) {
      res.status(400).json({
        reason: 'invalid-password',
      })
      return
    }

    try {
      const existingUser = await getUserByEmail(email)
      if (existingUser) {
        res.status(400).json({
          reason: 'user-exists',
        })
        return
      }

      const { workspace, user } = await prisma().$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            name: payload.data.name,
            passwordDigest: await hashPassword(password),
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

      const loginLink = createLoginLink(user.id, config.FRONTEND_URL)

      res.status(201).json({ workspace, loginLink })
    } catch (err) {
      req.log.error({ err }, 'Failed to handle sign-up request')
      res.sendStatus(500)
    }
  })

  router.post('/sign-in/password', async (req, res) => {
    const payload = z
      .object({ email: z.string().trim().email(), password: z.string() })
      .safeParse(req.body)
    if (!payload.success) {
      res.status(400).end()
      return
    }

    const { email, password } = payload.data

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

    const loginLink = createLoginLink(user.id, config.FRONTEND_URL)

    res.json({ email: obscureEmail(user.email), loginLink })
  })

  router.get('/session', authenticationMiddleware, async (req, res) => {
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
  })

  router.get('/logout', authenticationMiddleware, async (req, res) => {
    const query = z.object({ callback: callbackUrlSchema }).safeParse(req.query)
    if (!query.success) {
      res.status(400).end()
      return
    }

    res.clearCookie('token')

    res.redirect(query.data.callback)
  })

  return router
}
