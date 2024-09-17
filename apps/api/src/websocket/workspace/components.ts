import prisma, {
  APIReusableComponent,
  listReusableComponents,
} from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { logger } from '../../logger.js'

export async function emitComponents(socket: Socket, workspaceId: string) {
  const components = await listReusableComponents(workspaceId)

  socket.emit('workspace-components', { workspaceId, components })
}

export async function broadcastComponent(
  socket: IOServer,
  component: APIReusableComponent
) {
  const workspaceId = (
    await prisma().document.findUnique({
      where: { id: component.documentId },
    })
  )?.workspaceId

  if (!workspaceId) {
    logger().error(
      {
        workspaceId: component.documentId,
        componentId: component.id,
      },
      'Could not find workspace for component'
    )
    return
  }

  socket.to(workspaceId).emit('workspace-component-update', {
    workspaceId,
    component,
  })
}

export async function broadcastComponentRemoved(
  socket: IOServer,
  workspaceId: string,
  componentId: string
) {
  socket.to(workspaceId).emit('workspace-component-removed', {
    workspaceId,
    componentId,
  })
}
