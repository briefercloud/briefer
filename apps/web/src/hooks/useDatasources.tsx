import { Map, List } from 'immutable'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import useWebsocket from './useWebsocket'
import type { APIDataSource, DataSourceType } from '@briefer/database'
import { DataSourceSchema, DataSourceTable } from '@briefer/types'
import { omit } from 'ramda'

export type APIDataSources = List<APIDataSource>

type API = {
  ping: (
    workspaceId: string,
    id: string,
    type: string
  ) => Promise<{
    lastConnection: string | null
    connStatus: 'online' | 'offline'
  }>
  remove: (workspaceId: string, id: string) => void
  makeDefault: (workspaceId: string, id: string) => void
  refreshAll: (workspaceId: string) => Promise<void>
  refreshOne: (
    workspaceId: string,
    dataSourceId: string,
    dataSourceType: DataSourceType
  ) => void
}

// {
//   [dataSourceId]: {
//     [schemaName]: {
//       tables: {
//         [tableName]: DataSourceTable
//       }
//     }
//   }
// }
type Schemas = Map<string, Map<string, DataSourceSchema>>

type State = Map<
  string,
  {
    datasources: APIDataSources
    schemas: Schemas
  }
>

const Context = createContext<[State, API]>([
  Map(),
  {
    ping: async () => {
      throw new Error(
        'Attempted to call data source ping without DataSourcesProvider'
      )
    },
    remove: async () => {
      throw new Error(
        'Attempted to call data source remove without DataSourcesProvider'
      )
    },
    makeDefault: async () => {
      throw new Error(
        'Attempted to call data source make default without DataSourcesProvider'
      )
    },
    refreshAll: async () => {
      throw new Error(
        'Attempted to call data source refresh all without DataSourcesProvider'
      )
    },
    refreshOne: async () => {
      throw new Error(
        'Attempted to call data source refresh one without DataSourcesProvider'
      )
    },
  },
])

type UseDataSources = [
  {
    datasources: APIDataSources
    schemas: Schemas
    isLoading: boolean
  },
  API
]
export const useDataSources = (workspaceId: string): UseDataSources => {
  const [state, api] = useContext(Context)
  return useMemo(() => {
    const data = state.get(workspaceId) ?? {
      datasources: List(),
      schemas: Map(),
    }
    return [{ ...data, isLoading: !state.has(workspaceId) }, api]
  }, [state, workspaceId, api])
}

interface Props {
  children: React.ReactNode
}
export function DataSourcesProvider(props: Props) {
  const socket = useWebsocket()
  const [state, setState] = useState<State>(Map())

  useEffect(() => {
    if (!socket) {
      return
    }

    const onDataSources = (data: {
      workspaceId: string
      dataSources: APIDataSource[]
    }) => {
      setState((state) =>
        state.set(data.workspaceId, {
          datasources: List(data.dataSources),
          schemas: state.get(data.workspaceId)?.schemas ?? Map(),
        })
      )
    }
    socket.on('workspace-datasources', onDataSources)

    const onDataSourceUpdate = ({
      workspaceId,
      dataSource,
    }: {
      workspaceId: string
      dataSource: APIDataSource
    }) => {
      setState((state) => {
        const datasources =
          state.get(workspaceId)?.datasources ?? List<APIDataSource>()
        const index = datasources.findIndex(
          (ds) => ds.config.data.id === dataSource.config.data.id
        )

        return state.set(workspaceId, {
          datasources:
            index === -1
              ? datasources.push(dataSource)
              : datasources.set(index, dataSource),
          schemas: state.get(workspaceId)?.schemas ?? Map(),
        })
      })
    }
    socket.on('workspace-datasource-update', onDataSourceUpdate)

    const onDataSourceSchemaTableUpdate = ({
      workspaceId,
      dataSourceId,
      schemaName,
      tableName,
      table,
    }: {
      workspaceId: string
      dataSourceId: string
      schemaName: string
      tableName: string
      table: DataSourceTable
    }) => {
      setState((state) => {
        const datasources = state.get(workspaceId)?.datasources ?? List()
        const allSchemas = state.get(workspaceId)?.schemas ?? Map()
        const dataSourceSchemas = allSchemas.get(dataSourceId) ?? Map()
        const schema = dataSourceSchemas.get(schemaName)
        const tables = {
          ...(schema?.tables ?? {}),
          [tableName]: table,
        }
        return state.set(workspaceId, {
          datasources,
          schemas: allSchemas.setIn([dataSourceId, schemaName], { tables }),
        })
      })
    }
    socket.on(
      'workspace-datasource-schema-table-update',
      onDataSourceSchemaTableUpdate
    )

    const onDataSourceSchemaTableRemoved = ({
      workspaceId,
      dataSourceId,
      schemaName,
      tableName,
    }: {
      workspaceId: string
      dataSourceId: string
      schemaName: string
      tableName: string
    }) => {
      setState((state) => {
        const datasources = state.get(workspaceId)?.datasources ?? List()
        const allSchemas = state.get(workspaceId)?.schemas ?? Map()
        const dataSourceSchemas = allSchemas.get(dataSourceId) ?? Map()
        const schema = dataSourceSchemas.get(schemaName)
        const tables = omit([tableName], schema?.tables ?? {})
        return state.set(workspaceId, {
          datasources,
          schemas: allSchemas.setIn([dataSourceId, schemaName], { tables }),
        })
      })
    }
    socket.on(
      'workspace-datasource-schema-table-removed',
      onDataSourceSchemaTableRemoved
    )
    return () => {
      socket.off('workspace-datasources', onDataSources)
      socket.off('workspace-datasource-update', onDataSourceUpdate)
      socket.off(
        'workspace-datasource-schema-table-update',
        onDataSourceSchemaTableUpdate
      )
      socket.off(
        'workspace-datasource-schema-table-removed',
        onDataSourceSchemaTableRemoved
      )
    }
  }, [socket])

  const ping = useCallback(
    async (workspaceId: string, id: string, type: string) => {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources/${id}/ping`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: type }),
        }
      )

      return res.json()
    },
    []
  )

  const remove = useCallback(async (workspaceId: string, id: string) => {
    const res = await fetch(
      `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources/${id}`,
      {
        credentials: 'include',
        method: 'DELETE',
      }
    )

    if (!res.ok) {
      // TODO proper error handling
      alert('Failed to remove data source')
    }
  }, [])

  const makeDefault = useCallback(async (workspaceId: string, id: string) => {
    try {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources/${id}/default`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isDefault: true,
          }),
        }
      )

      if (!res.ok) {
        alert('Failed to make data source default')
      }
    } catch (e) {
      alert('Failed to make data source default')
    }
  }, [])

  const refreshAll = useCallback(
    async (workspaceId: string) => {
      socket?.emit('workspace-datasources-refresh-all', workspaceId)
    },
    [socket]
  )

  const refreshOne = useCallback(
    async (
      workspaceId: string,
      dataSourceId: string,
      dataSourceType: DataSourceType
    ) => {
      socket?.emit('workspace-datasources-refresh-one', {
        workspaceId,
        dataSourceId,
        dataSourceType,
      })
    },
    [socket]
  )

  const value: [State, API] = useMemo(
    () => [
      state,
      {
        ping,
        remove,
        makeDefault,
        refreshAll,
        refreshOne,
      },
    ],
    [state, ping, remove, makeDefault, refreshAll, refreshOne]
  )

  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
