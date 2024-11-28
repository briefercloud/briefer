import { Map } from 'immutable'
import { type EnvironmentStatus } from '@briefer/database'
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react'
import useWebsocket from './useWebsocket'

function getDefaultStateItem(): StateItem {
  return {
    loading: true,
    error: null,
    status: 'Stopped',
    startedAt: null,
  }
}
export type StateItem = {
  loading: boolean
  error: string | null
  status: EnvironmentStatus
  startedAt: string | null
}
type State = Map<string, StateItem>

type API = {
  getEnvironmentStatus: (workspaceId: string) => void
  restart: (workspaceId: string) => void
}

type ContextValue = [State, API]
const Context = createContext<ContextValue>([
  Map(),
  {
    getEnvironmentStatus: () => {},
    restart: () => {},
  },
])

type Props = {
  children: React.ReactNode
}
export function EnvironmentStatusProvider(props: Props) {
  const socket = useWebsocket()
  const [state, setState] = useState<State>(Map())

  useEffect(() => {
    if (!socket) {
      return
    }

    const onStatus = (data: {
      workspaceId: string
      status: EnvironmentStatus
      startedAt: string | null
    }) => {
      setState((s) =>
        s.set(data.workspaceId, {
          loading: false,
          error: null,
          status: data.status,
          startedAt: data.startedAt ? data.startedAt : null,
        })
      )
    }
    socket.on('environment-status-update', onStatus)

    const onError = (data: { workspaceId: string; error: string }) => {
      setState((s) =>
        s.set(data.workspaceId, {
          ...(s.get(data.workspaceId) ?? getDefaultStateItem()),
          error: data.error,
        })
      )
    }
    socket.on('environment-status-error', onError)

    return () => {
      socket.off('environment-status-update', onStatus)
      socket.off('environment-status-error', onError)
    }
  }, [socket, setState])

  useEffect(() => {
    if (!socket) {
      return
    }

    const onDisconnect = () => {
      setState((s) => s.map((s) => ({ ...s, loading: true, error: null })))
    }
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('disconnect', onDisconnect)
    }
  }, [socket, setState])

  const getEnvironmentStatus = useCallback(
    (workspaceId: string) => {
      if (!socket) {
        return
      }

      socket.emit('get-environment-status', { workspaceId })
    },
    [socket]
  )

  const restart = useCallback(
    (workspaceId: string) => {
      if (!socket) {
        return
      }

      socket.emit('restart-environment', { workspaceId })
    },
    [socket]
  )

  const value: ContextValue = useMemo(
    () => [
      state,
      {
        getEnvironmentStatus,
        restart,
      },
    ],
    [state, getEnvironmentStatus]
  )
  return <Context.Provider value={value}>{props.children}</Context.Provider>
}

type UseEnvironmentStatus = {
  status: EnvironmentStatus
  loading: boolean
  error: string | null
  restart: () => void
  startedAt: string | null
}
export function useEnvironmentStatus(
  workspaceId: string
): UseEnvironmentStatus {
  const [state, api] = useContext(Context)
  useEffect(() => {
    api.getEnvironmentStatus(workspaceId)
  }, [api.getEnvironmentStatus, workspaceId])

  const restart = useCallback(() => {
    api.restart(workspaceId)
  }, [api.restart, workspaceId])

  return useMemo(
    () => ({ ...(state.get(workspaceId) ?? getDefaultStateItem()), restart }),
    [state, workspaceId]
  )
}
