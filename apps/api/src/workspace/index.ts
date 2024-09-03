import {
  ApiUser,
  prisma,
  PrismaTransaction,
  UserWorkspaceRole,
  Workspace,
} from '@briefer/database'
import { z } from 'zod'
import { IOServer } from '../websocket/index.js'

export const WorkspaceCreateValues = z.object({
  name: z.string(),
  useContext: z
    .union([z.literal('work'), z.literal('personal'), z.literal('studies')])
    .optional(),
  useCases: z.array(z.string()).optional(),
  source: z.string().optional(),
  inviteEmails: z.array(z.string()).optional(),
})
export type WorkspaceCreateInput = z.infer<typeof WorkspaceCreateValues>

export interface IWorkspaceCreator {
  createWorkspace(
    owner: ApiUser,
    input: WorkspaceCreateInput,
    socketServer: IOServer,
    tx?: PrismaTransaction
  ): Promise<{ workspace: Workspace; invitedUsers: ApiUser[] }>
}

export class WorkspaceCreator implements IWorkspaceCreator {
  public async createWorkspace(
    owner: ApiUser,
    input: WorkspaceCreateInput,
    _socketServer: IOServer,
    tx?: PrismaTransaction
  ): Promise<{ workspace: Workspace; invitedUsers: ApiUser[] }> {
    const run = async (tx: PrismaTransaction) => {
      const data = {
        name: input.name,
        useContext: input.useContext,
        useCases: input.useCases,
        source: input.source,
        ownerId: owner.id,
      }

      const workspace = await tx.workspace.create({
        data,
      })

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
