import {
  ApiUser,
  prisma,
  PrismaTransaction,
  UserWorkspaceRole,
  ApiWorkspace,
  createWorkspace as prismaCreateWorkspace,
} from '@briefer/database'
import { z } from 'zod'
import { IOServer } from '../websocket/index.js'
import { WorkspaceCreateInput } from '@briefer/types'

export interface IWorkspaceCreator {
  createWorkspace(
    owner: ApiUser,
    input: WorkspaceCreateInput,
    socketServer: IOServer,
    tx?: PrismaTransaction
  ): Promise<{ workspace: ApiWorkspace; invitedUsers: ApiUser[] }>
}

export class WorkspaceCreator implements IWorkspaceCreator {
  public async createWorkspace(
    owner: ApiUser,
    input: WorkspaceCreateInput,
    _socketServer: IOServer,
    tx?: PrismaTransaction
  ): Promise<{ workspace: ApiWorkspace; invitedUsers: ApiUser[] }> {
    const run = async (tx: PrismaTransaction) => {
      const workspace = await prismaCreateWorkspace(input, owner.id, tx)

      let userWorkspaceAssociations = [
        {
          userId: owner.id,
          workspaceId: workspace.id,
          role: 'admin' as UserWorkspaceRole,
        },
      ]

      // Find or create users and prepare userWorkspace associations
      const guestUsers = await Promise.all(
        (input.inviteEmails ?? [])
          .map((e) => e.trim())
          .map(async (email) => {
            const user: ApiUser = await tx.user.upsert({
              where: { email },
              update: {},
              create: { email, name: email },
              select: {
                id: true,
                email: true,
                name: true,
                picture: true,
                createdAt: true,
                updatedAt: true,
              },
            })

            userWorkspaceAssociations.push({
              userId: user.id,
              workspaceId: workspace.id,
              role: 'editor',
            })

            return user
          })
      )

      await tx.userWorkspace.createMany({
        data: userWorkspaceAssociations,
        skipDuplicates: true,
      })

      return { workspace, invitedUsers: guestUsers }
    }

    const workspace = tx ? await run(tx) : await prisma().$transaction(run)

    return workspace
  }
}

let instance: IWorkspaceCreator | null
export async function createWorkspace(
  owner: ApiUser,
  input: WorkspaceCreateInput,
  socketServer: IOServer,
  tx: PrismaTransaction
): Promise<Workspace> {
  if (instance) {
    return (await instance.createWorkspace(owner, input, socketServer, tx))
      .workspace
  }

  instance = new WorkspaceCreator()
  return (await instance.createWorkspace(owner, input, socketServer, tx))
    .workspace
}
