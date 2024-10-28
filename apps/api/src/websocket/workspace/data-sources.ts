import prisma, {
  APIDataSource,
  DataSourceType,
  getDatasource,
  listDataSources,
} from '@briefer/database'
import { IOServer, Socket } from '../index.js'
import { z } from 'zod'
import { Session } from '../../types.js'
import { fetchDataSourceStructure } from '../../datasources/structure.js'
import { DataSourceColumn, DataSourceTable, uuidSchema } from '@briefer/types'
import { logger } from '../../logger.js'

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
  const schemaToDataSourceId = new Map(
    dataSources.map((d) => [d.structure.id, d.config.data.id])
  )
  const schemaIds = dataSources.map((d) => d.structure.id)

  const batchSize = 100
  let skip = 0
  let hasMoreResults = true

  while (hasMoreResults) {
    const tables = await prisma().dataSourceSchemaTable.findMany({
      where: { dataSourceSchemaId: { in: schemaIds } },
      skip,
      take: batchSize,
      orderBy: { createdAt: 'asc' },
    })

    skip += batchSize
    hasMoreResults = tables.length === batchSize // If fewer than 100 results are returned, we're done

    for (const table of tables) {
      const dataSourceId = schemaToDataSourceId.get(table.dataSourceSchemaId)
      if (!dataSourceId) {
        continue
      }

      const columns = z.array(DataSourceColumn).safeParse(table.columns)
      if (!columns.success) {
        logger().error(
          {
            tableId: table.id,
            dataSourceId,
            workspaceId,
          },
          'Error parsing columns for table'
        )
        continue
      }

      socket.emit('workspace-datasource-schema-table-update', {
        workspaceId,
        dataSourceId,
        schemaName: table.schema,
        tableName: table.name,
        table: { columns: columns.data },
      })
    }
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
