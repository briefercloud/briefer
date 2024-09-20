import {
  APIDataSource,
  DataSource,
  getDatasource,
  listDataSources,
} from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { z } from 'zod'
import { Session } from '../../types.js'
import { fetchDataSourceStructure } from '../../datasources/structure.js'

export function refreshDataSources(
  socketServer: IOServer,
  socket: Socket,
  { userWorkspaces }: Session
) {
  return async (data: unknown) => {
    const payload = z.object({ workspaceId: z.string() }).safeParse(data)
    if (!payload.success) {
      return
    }

    const role = userWorkspaces[payload.data.workspaceId]?.role
    if (!role) {
      socket.disconnect(true)
      return
    }

    const { workspaceId } = payload.data
    emitDataSources(socketServer, socket, workspaceId)
  }
}

export async function emitDataSources(
  socketServer: IOServer,
  socket: Socket,
  workspaceId: string
) {
  const dataSources = await listDataSources(workspaceId)
  const result: APIDataSource[] = await Promise.all(
    dataSources.map(async (d) => {
      const structure = await fetchDataSourceStructure(socketServer, d, {
        forceRefresh: false,
      })
      return { config: d, structure }
    })
  )

  socket.emit('workspace-datasources', { workspaceId, dataSources: result })
}

export async function broadcastDataSource(
  socket: IOServer,
  dataSource: APIDataSource
) {
  socket
    .to(dataSource.config.data.workspaceId)
    .emit('workspace-datasource-update', {
      workspaceId: dataSource.config.data.workspaceId,
      dataSource,
    })
}

export async function broadcastDataSources(
  socket: IOServer,
  workspaceId: string
) {
  const dataSources = await listDataSources(workspaceId)
  const result: APIDataSource[] = await Promise.all(
    dataSources.map(async (d) => {
      const structure = await fetchDataSourceStructure(socket, d, {
        forceRefresh: false,
      })

      return { config: d, structure }
    })
  )

  socket.to(workspaceId).emit('workspace-datasources', {
    workspaceId,
    dataSources: result,
  })
}
