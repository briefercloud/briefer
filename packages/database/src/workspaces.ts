import prisma, { PrismaTransaction } from './index.js'
import { UserWorkspace, Workspace } from '@prisma/client'
import { WorkspaceCreateInput, WorkspaceEditFormValues } from '@briefer/types'

type WorkspaceWithSecrets = Workspace & {
  secrets: {
    id: string
    openAiApiKey: string | null
  } | null
}

export type ApiWorkspace = Workspace & {
  secrets: {
    hasOpenAiApiKey: boolean
  }
}

const transformSecrets = (workspace: WorkspaceWithSecrets): ApiWorkspace => ({
  ...workspace,
  secrets: {
    hasOpenAiApiKey: !!workspace.secrets?.openAiApiKey,
  },
})

export async function getWorkspacesForUser(userId: string) {
  const uw = await prisma().userWorkspace.findMany({
    where: { userId },
    include: {
      workspace: {
        include: {
          secrets: true,
        },
      },
    },
    orderBy: {
      workspace: { name: 'asc' },
    },
  })

  return uw.map(({ workspace }) => transformSecrets(workspace))
}

export async function getWorkspaceWithSecrets(workspaceId: string) {
  return await prisma().workspace.findFirst({
    where: {
      id: workspaceId,
    },
    select: {
      assistantModel: true,
      secrets: {
        select: {
          openAiApiKey: true,
        },
      },
    },
  })
}

export async function getWorkspaceById(id: string) {
  const w = await prisma().workspace.findUnique({
    where: { id },
    include: {
      secrets: true,
    },
  })

  return w ? transformSecrets(w) : null
}

export async function getWorkspaceForDocument(documentId: string) {
  const w = await prisma().workspace.findFirst({
    where: { documents: { some: { id: documentId } } },
    include: { secrets: true },
  })

  return w ? transformSecrets(w) : null
}

export async function updateWorkspace(
  id: string,
  data: WorkspaceEditFormValues
) {
  const w = await prisma().workspace.update({
    where: { id },
    data: {
      name: data.name,
      assistantModel: data.assistantModel,
      secrets: {
        upsert: {
          update: {
            openAiApiKey: data.openAiApiKey,
          },
          create: {
            openAiApiKey: data.openAiApiKey,
          },
        },
      },
    },
    include: { secrets: true },
  })

  return transformSecrets(w)
}

export async function createWorkspace(
  wData: WorkspaceCreateInput,
  ownerId: string,
  users: Pick<UserWorkspace, 'userId' | 'role'>[],
  tx?: PrismaTransaction
) {
  const w = await (tx ?? prisma()).workspace.create({
    data: {
      ...wData,
      owner: { connect: { id: ownerId } },
      secrets: {
        create: {
          openAiApiKey: null,
        },
      },
      users: {
        createMany: {
          data: users.map((u) => ({
            role: u.role,
            userId: u.userId,
          })),
          skipDuplicates: true,
        },
      },
      onboardingTutorial: {
        create: {
          currentStep: 'connectDataSource',
          isComplete: false,
        },
      },
    },
    include: { secrets: true },
  })

  return transformSecrets(w)
}
