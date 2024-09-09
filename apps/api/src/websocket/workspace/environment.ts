import prisma, { EnvironmentStatus, UserWorkspaceRole } from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'
import { Session } from '../../types.js'
import { getJupyterManager } from '../../jupyter/index.js'

export async function emitEnvironmentStatus(
  socket: Socket,
  workspaceId: string,
  status: EnvironmentStatus,
  startedAt: string | null
) {
  socket.emit('environment-status-update', {
    workspaceId,
    status,
    startedAt: status === 'Running' ? startedAt : null,
  })
}

export async function broadcastEnvironmentStatus(
  socket: IOServer,
  workspaceId: string,
  status: EnvironmentStatus,
  startedAt: string | null
) {
  socket.to(workspaceId).emit('environment-status-update', {
    workspaceId,
    status,
    startedAt: status === 'Running' ? startedAt : null,
  })
}

export function handleGetEnvironmentStatus(socket: Socket, session: Session) {
  return async (data: unknown) => {
    const payload = z.object({ workspaceId: uuidSchema }).safeParse(data)
    if (!payload.success) {
      return
    }
    const { workspaceId } = payload.data
    const userWorkspace = session.userWorkspaces[workspaceId]
    if (!userWorkspace) {
      socket.emit('environment-status-error', {
        workspaceId,
        error: 'forbidden',
      })
      return
    }

    if (!socket.rooms.has(workspaceId)) {
      socket.emit('environment-status-error', {
        workspaceId,
        error: 'workspace-not-joined',
      })
      return
    }

    const environment = await prisma().environment.findFirst({
      where: { workspaceId },
      select: { status: true, startedAt: true },
    })

    emitEnvironmentStatus(
      socket,
      workspaceId,
      environment?.status ?? 'Stopped',
      environment?.startedAt?.toISOString() ?? null
    )
  }
}

export function handleRestartEnvironment(socket: Socket, session: Session) {
  return async (data: unknown) => {
    const payload = z.object({ workspaceId: uuidSchema }).safeParse(data)
    if (!payload.success) {
      return
    }
    const { workspaceId } = payload.data
    const userWorkspace = session.userWorkspaces[workspaceId]
    if (!userWorkspace) {
      socket.emit('environment-status-error', {
        workspaceId,
        error: 'forbidden',
      })
      return
    }

    if (!socket.rooms.has(workspaceId)) {
      socket.emit('environment-status-error', {
        workspaceId,
        error: 'workspace-not-joined',
      })
      return
    }

    if (userWorkspace.role === UserWorkspaceRole.viewer) {
      socket.emit('environment-status-error', {
        workspaceId,
        error: 'forbidden',
      })
      return
    }

    await getJupyterManager().restart(workspaceId)
  }
}
