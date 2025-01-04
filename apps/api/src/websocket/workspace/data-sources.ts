import {
  APIDataSource,
  DataSourceType,
  getDatasource,
  listDataSources,
} from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { z } from 'zod'
import { Session } from '../../types.js'
import {
  fetchDataSourceStructure,
  listSchemaTables,
  SchemaTableItem,
} from '../../datasources/structure.js'
import { DataSourceTable, uuidSchema } from '@briefer/types'

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

export function refreshDataSource(
  socketServer: IOServer,
  socket: Socket,
  { userWorkspaces }: Session
) {
  return async (data: unknown) => {
    const payload = z
      .object({
        workspaceId: uuidSchema,
        dataSourceType: DataSourceType,
        dataSourceId: uuidSchema,
      })
      .safeParse(data)
    if (!payload.success) {
      return
    }

    const role = userWorkspaces[payload.data.workspaceId]?.role
    if (!role) {
      socket.disconnect(true)
      return
    }

    const { workspaceId, dataSourceType, dataSourceId } = payload.data
    const config = await getDatasource(
      workspaceId,
      dataSourceId,
      dataSourceType
    )
    if (!config) {
      return
    }

    const structure = await fetchDataSourceStructure(socketServer, config, {
      forceRefresh: true,
    })
    broadcastDataSource(socketServer, { config, structure })
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
  emitSchemas(socket, workspaceId, result)
}

async function emitSchemas(
  socket: Socket,
  workspaceId: string,
  dataSources: APIDataSource[]
) {
  let batch: SchemaTableItem[] = []
  for await (const schemaTable of listSchemaTables(dataSources)) {
    batch.push(schemaTable)
    if (batch.length >= 100) {
      socket.emit('workspace-datasource-schema-tables', {
        workspaceId,
        tables: batch,
      })
      batch = []
    }
  }

  if (batch.length > 0) {
    socket.emit('workspace-datasource-schema-tables', {
      workspaceId,
      tables: batch,
    })
  }
}

export function broadcastDataSource(
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

export function broadcastDataSourceSchemaTableRemoved(
  socket: IOServer,
  workspaceId: string,
  dataSourceId: string,
  schemaName: string,
  tableName: string
) {
  socket.to(workspaceId).emit('workspace-datasource-schema-table-removed', {
    workspaceId,
    dataSourceId,
    schemaName,
    tableName,
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

export async function broadcastDataSourceSchemaTableUpdate(
  socket: IOServer,
  workspaceId: string,
  dataSourceId: string,
  schemaName: string,
  tableName: string,
  table: DataSourceTable
) {
  socket.to(workspaceId).emit('workspace-datasource-schema-table-update', {
    workspaceId,
    dataSourceId,
    schemaName,
    tableName,
    table,
  })
}
