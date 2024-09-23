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
  refreshAll: (workspaceId: string) => Promise<void>
  refreshOne: (
    workspaceId: string,
    dataSourceId: string,
    dataSourceType: DataSourceType
  ) => void
}

type State = Map<string, APIDataSources>

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

type UseDataSources = [{ data: APIDataSources; isLoading: boolean }, API]
export const useDataSources = (workspaceId: string): UseDataSources => {
  const [state, api] = useContext(Context)
  return useMemo(() => {
    const data = state.get(workspaceId)
    return [{ data: data ?? List(), isLoading: !data }, api]
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
      setState((state) => state.set(data.workspaceId, List(data.dataSources)))
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
        const datasources = state.get(workspaceId, List<APIDataSource>())
        const index = datasources.findIndex(
          (ds) => ds.config.data.id === dataSource.config.data.id
        )

        return state.set(
          workspaceId,
          index === -1
            ? datasources.push(dataSource)
            : datasources.set(index, dataSource)
        )
      })
    }

    socket.on('workspace-datasource-update', onDataSourceUpdate)

    return () => {
      socket.off('workspace-datasources', onDataSources)
      socket.off('workspace-datasource-update', onDataSourceUpdate)
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
        refreshAll,
        refreshOne,
      },
    ],
    [state, ping, remove, refreshAll, refreshOne]
  )

  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
