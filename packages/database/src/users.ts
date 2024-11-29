import prisma, { recoverFromNotFound } from './index.js'
import { User, UserWorkspaceRole } from '@prisma/client'

export type ApiUser = Omit<User, 'passwordDigest' | 'confirmedAt'>

export type WorkspaceUser = ApiUser & {
  workspaceId: string
  role: UserWorkspaceRole
}

export async function createUser(
  email: string,
  name: string | null,
  passwordDigest?: string
): Promise<ApiUser> {
  return prisma().user.create({
    data: {
      name: name ?? email,
      email,
      passwordDigest,
    },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      createdAt: true,
      updatedAt: true,
      lastVisitedWorkspaceId: true,
    },
  })
}

export async function getUserById(id: string): Promise<ApiUser | null> {
  const user = await prisma().user.findUnique({
    where: {
      id,
    },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      lastVisitedWorkspaceId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return user
}

export async function getUserByEmail(email: string): Promise<ApiUser | null> {
  const user = await prisma().user.findUnique({
    where: {
      email,
    },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      lastVisitedWorkspaceId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return user
}

export async function listWorkspaceUsers(
  workspaceId: string
): Promise<WorkspaceUser[]> {
  const users = await prisma().userWorkspace.findMany({
    where: { workspaceId },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          lastVisitedWorkspaceId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      role: true,
    },
  })

  return users.map((userWorkspace) => ({
    ...userWorkspace.user,
    role: userWorkspace.role,
    workspaceId,
  }))
}

export async function addUserToWorkspace(
  userId: string,
  workspaceId: string,
  role: UserWorkspaceRole
): Promise<WorkspaceUser | null> {
  const userWorkspace = await prisma().userWorkspace.create({
    data: {
      userId,
      workspaceId,
      role,
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          lastVisitedWorkspaceId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  })

  return {
    ...userWorkspace.user,
    role,
    workspaceId,
  }
}

export async function deleteUserFromWorkspace(
  userId: string,
  workspaceId: string
): Promise<WorkspaceUser | null> {
  const userWorkspace = await prisma().userWorkspace.delete({
    where: {
      userId_workspaceId: {
        userId,
        workspaceId,
      },
    },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          picture: true,
          lastVisitedWorkspaceId: true,
          createdAt: true,
          updatedAt: true,
        },
      },
      role: true,
    },
  })

  return {
    ...userWorkspace.user,
    workspaceId,
    role: userWorkspace.role,
  }
}

export async function confirmUser(userId: string): Promise<ApiUser | null> {
  const user = await recoverFromNotFound(
    prisma().user.update({
      where: { id: userId, confirmedAt: null },
      data: {
        confirmedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        name: true,
        picture: true,
        lastVisitedWorkspaceId: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  )

  return user
}
