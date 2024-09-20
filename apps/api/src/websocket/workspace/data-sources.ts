import {
  APIDataSource,
  DataSource,
  getDatasource,
  listDataSources,
} from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { getStructure } from '../../datasources/structure.js'
import { DataSourceStructure } from '@briefer/types'
import { z } from 'zod'
import { Session } from '../../types.js'

const raceStructure = async (d: DataSource) =>
  Promise.race<DataSourceStructure>([
    new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            dataSourceId: d.data.id,
            schemas: {},
            defaultSchema: '',
          }),
        2000
      )
    ),
    getStructure(d),
  ])

export function refreshDataSources(
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
    emitDataSources(socket, workspaceId)
  }
}

export async function emitDataSources(socket: Socket, workspaceId: string) {
  const dataSources = await listDataSources(workspaceId)
  const result: APIDataSource[] = await Promise.all(
    dataSources.map(async (d) => {
      const structure = await raceStructure(d)

      return { config: d, structure }
    })
  )

  socket.emit('workspace-datasources', { workspaceId, dataSources: result })
}

export async function broadcastDataSource(
  socket: IOServer,
  workspaceId: string,
  dataSourceId: string,
  type: DataSource['type']
) {
  const dataSource = await getDatasource(workspaceId, dataSourceId, type)
  if (!dataSource) {
    return
  }

  const result = {
    config: dataSource,
    structure: await raceStructure(dataSource),
  }

  socket.to(workspaceId).emit('workspace-datasource-update', {
    workspaceId,
    dataSource: result,
  })
}

export async function broadcastDataSources(
  socket: IOServer,
  workspaceId: string
) {
  const dataSources = await listDataSources(workspaceId)
  const result: APIDataSource[] = await Promise.all(
    dataSources.map(async (d) => {
      const structure = await raceStructure(d)

      return { config: d, structure }
    })
  )

  socket.to(workspaceId).emit('workspace-datasources', {
    workspaceId,
    dataSources: result,
  })
}
