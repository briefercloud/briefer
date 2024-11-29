import prisma from '@briefer/database'
import { emitEnvironmentStatus } from './environment.js'
import { emitDocuments } from './documents.js'
import { IOServer, Socket } from '../index.js'
import { logger } from '../../logger.js'
import { Session } from '../../types.js'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'
import { emitDataSources } from './data-sources.js'
import { emitComponents } from './components.js'

export const joinWorkspace =
  (io: IOServer, socket: Socket, session: Session) => async (data: unknown) => {
    const payload = z.object({ workspaceId: uuidSchema }).safeParse(data)
    if (!payload.success) {
      return
    }

    const { workspaceId } = payload.data
    try {
      const userWorkspace = session.userWorkspaces[workspaceId]
      if (!userWorkspace) {
        // workspace might've been created after the user logged in
        const userWorkspace = await prisma().userWorkspace.findFirst({
          where: {
            workspaceId,
            userId: session.user.id,
          },
        })
        if (!userWorkspace) {
          socket.emit('workspace-error', { workspaceId, error: 'forbidden' })
          return
        }

        session.userWorkspaces[workspaceId] = userWorkspace
      }

      if (!socket.rooms.has(workspaceId)) {
        await socket.join(workspaceId)
        await prisma().user.update({
          where: { id: session.user.id },
          data: {
            lastVisitedWorkspaceId: workspaceId,
          },
        })
      }

      await emitInitialData(io, socket, workspaceId)
    } catch (err) {
      logger().error(
        { err, workspaceId, userId: session.user.id },
        'Error joining workspace'
      )
      socket.emit('workspace-error', { workspaceId, error: 'unexpected' })
    }
  }

export const leaveWorkspace =
  (socket: Socket, session: Session) => async (data: any) => {
    const { workspaceId } = data

    try {
      await socket.leave(workspaceId)
    } catch (err) {
      logger().error(
        { err, workspaceId, userId: session.user.id },
        'Error leaving workspace'
      )
      socket.emit('workspace-error', { workspaceId, error: 'unexpected' })
    }
  }

async function emitInitialData(
  io: IOServer,
  socket: Socket,
  workspaceId: string
) {
  await Promise.all([
    emitDocuments(socket, workspaceId),
    emitEnvironmentStatus(socket, workspaceId),
    emitDataSources(io, socket, workspaceId),
    emitComponents(socket, workspaceId),
  ])
}
