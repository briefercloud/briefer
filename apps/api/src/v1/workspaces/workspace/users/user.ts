import prisma, {
  UserWorkspaceRole,
  deleteUserFromWorkspace,
  recoverFromNotFound,
} from '@briefer/database'
import { getParam } from '../../../../utils/express.js'
import { Router } from 'express'
import { z } from 'zod'
import {
  comparePassword,
  generatePassword,
  hashPassword,
} from '../../../../password.js'

const userRouter = Router({ mergeParams: true })

userRouter.put('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const userId = getParam(req, 'userId')

  const requestUserRole = req.session.userWorkspaces[workspaceId]?.role
  if (!requestUserRole) {
    res.sendStatus(403)
    return
  }

  if (
    requestUserRole !== UserWorkspaceRole.admin &&
    req.session.user.id !== userId
  ) {
    res.sendStatus(403)
    return
  }

  const currentUser = await prisma().user.findUnique({
    where: { id: userId },
  })
  if (!currentUser) {
    res.sendStatus(404)
    return
  }

  const payload = z
    .object({
      name: z.string().optional(),
      role: z.nativeEnum(UserWorkspaceRole).optional(),
      currentPassword: z.string().optional(),
      newPassword: z.string().optional(),
    })
    .safeParse(req.body)

  if (!payload.success) {
    res.status(400).json({
      reason: 'invalid-payload',
    })
    return
  }

  let name = payload.data.name?.trim()
  if (name === '') {
    name = undefined
  }
  const newRole = payload.data.role
  const currentPassword = payload.data.currentPassword
  const newPassword = payload.data.newPassword

  if (newPassword && req.session.user.id !== userId) {
    // only allow changing password for self
    res.sendStatus(403)
    return
  }

  if (newRole && requestUserRole !== UserWorkspaceRole.admin) {
    res.sendStatus(403)
    return
  }

  if (newPassword && currentPassword && currentUser.passwordDigest !== null) {
    const isPasswordCorrect = await comparePassword({
      encrypted: currentUser.passwordDigest,
      password: currentPassword,
    })
    if (!isPasswordCorrect) {
      res.status(400).json({
        reason: 'incorrect-password',
      })
      return
    }
  }

  const nextPasswordDigest = newPassword
    ? await hashPassword(newPassword)
    : undefined

  const user = await prisma().userWorkspace.update({
    where: { userId_workspaceId: { userId, workspaceId } },
    data: {
      role: newRole,
      user: {
        update: {
          name,
          passwordDigest: nextPasswordDigest,
        },
      },
    },
    select: {
      role: true,
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  res.status(200).json({
    ...user.user,
    role: user.role,
    workspaceId,
  })
})

userRouter.delete('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const userId = getParam(req, 'userId')

  if (userId === req.session.user.id) {
    res.status(400).json({
      message: 'delete-self',
    })
    return
  }

  const workspaceUsersCount = await prisma().userWorkspace.count({
    where: { workspaceId },
  })

  if (workspaceUsersCount <= 1) {
    res.status(400).json({
      message: 'last-user',
    })
    return
  }

  const targetUser = await recoverFromNotFound(
    deleteUserFromWorkspace(userId, workspaceId)
  )
  if (!targetUser) {
    res.status(404).end()
    return
  }

  res.status(200).json(targetUser)
})

userRouter.post('/reset-password', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const userId = getParam(req, 'userId')

  if (
    req.session.userWorkspaces[workspaceId]?.role !== UserWorkspaceRole.admin
  ) {
    res.sendStatus(403)
    return
  }

  try {
    const user = await prisma().user.findUnique({
      where: { id: userId },
      select: { email: true },
    })
    if (!user) {
      res.sendStatus(404)
      return
    }

    const password = generatePassword(24)
    const passwordDigest = await hashPassword(password)

    await prisma().user.update({
      where: { id: userId },
      data: { passwordDigest },
    })

    res.json({ password })
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        userId,
        err,
      },
      'Failed to reset password'
    )
    res.sendStatus(500)
  }
})

export default userRouter
