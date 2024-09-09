import prisma from './index.js'
import { Environment, EnvironmentStatus as EnvStatusType } from '@prisma/client'

export { Environment }

export type EnvironmentStatus =
  | 'Running'
  | 'Stopped'
  | 'Failing'
  | 'Starting'
  | 'Stopping'

export async function getEnvironment(
  workspaceId: string
): Promise<Environment | null> {
  return prisma().environment.findUnique({
    where: { workspaceId },
  })
}

export async function upsertEnvironment(
  workspaceId: string,
  resourceVersion: number,
  lastActivityAt: Date,
  status: EnvStatusType
): Promise<Environment> {
  const startedAt = status === 'Running' ? new Date() : null

  return prisma().environment.upsert({
    where: { workspaceId },
    create: { workspaceId, lastActivityAt, resourceVersion, status, startedAt },
    update: { lastActivityAt, resourceVersion, status, startedAt },
  })
}

export async function registerLastActivity(
  workspaceId: string,
  lastActivityAt: Date
) {
  return await prisma().environment.update({
    where: {
      workspaceId,
    },
    data: {
      lastActivityAt,
    },
  })
}
