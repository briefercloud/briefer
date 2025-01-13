import prisma, { PrismaTransaction } from './index.js'
import { Workspace } from '@prisma/client'
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
  tx?: any
) {
  const run = async (tx: PrismaTransaction) => {
    const s = await tx.workspaceSecrets.create({
      data: { openAiApiKey: null },
    })

    const w = await tx.workspace.create({
      data: { ...wData, ownerId, secretsId: s.id },
      include: { secrets: true },
    })

    return transformSecrets(w)
  }

  return tx
    ? run(tx)
    : prisma().$transaction(run, { maxWait: 31000, timeout: 30000 })
}
