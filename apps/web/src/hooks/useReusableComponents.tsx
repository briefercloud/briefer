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
import type {
  NewReusableComponent,
  APIReusableComponent,
  UpdateReusableComponent,
} from '@briefer/database'

export type ReusableComponents = List<APIReusableComponent>

type API = {
  create: (
    workspaceId: string,
    data: Omit<NewReusableComponent, 'id'> & { id: string },
    documenTitle: string
  ) => void
  update: (
    workspaceId: string,
    id: string,
    data: UpdateReusableComponent
  ) => void
  remove: (workspaceId: string, id: string) => void
}

type State = Map<string, ReusableComponents>

const Context = createContext<[State, API]>([
  Map(),
  {
    create: async () => {
      throw new Error(
        'Attempted to call component create without ReusableComponentsProvider'
      )
    },
    update: async () => {
      throw new Error(
        'Attempted to call component update without ReusableComponentsProvider'
      )
    },
    remove: async () => {
      throw new Error(
        'Attempted to call component remove without ReusableComponentsProvider'
      )
    },
  },
])

type UseReusableComponents = [
  { data: ReusableComponents; isLoading: boolean },
  API
]
export const useReusableComponents = (
  workspaceId: string
): UseReusableComponents => {
  const [state, api] = useContext(Context)
  return useMemo(() => {
    const data = state.get(workspaceId)
    return [{ data: data ?? List(), isLoading: !data }, api]
  }, [state, workspaceId, api])
}

interface Props {
  children: React.ReactNode
}
export function ReusableComponentsProvider(props: Props) {
  const socket = useWebsocket()
  const [state, setState] = useState<State>(Map())

  useEffect(() => {
    if (!socket) {
      return
    }

    const onReusableComponents = (data: {
      workspaceId: string
      components: APIReusableComponent[]
    }) => {
      setState((state) => state.set(data.workspaceId, List(data.components)))
    }

    socket.on('workspace-components', onReusableComponents)

    const onReusableComponentUpdate = (data: {
      workspaceId: string
      component: APIReusableComponent
    }) => {
      setState((state) => {
        const reusableComponents = state.get(
          data.workspaceId,
          List<APIReusableComponent>()
        )
        const index = reusableComponents.findIndex(
          (rc) => rc.id === data.component.id
        )

        return state.set(
          data.workspaceId,
          index === -1
            ? reusableComponents.push(data.component)
            : reusableComponents.set(index, data.component)
        )
      })
    }

    socket.on('workspace-component-update', onReusableComponentUpdate)

    const onReusableComponentRemoved = (data: {
      workspaceId: string
      componentId: string
    }) => {
      setState((state) => {
        const reusableComponents = state.get(
          data.workspaceId,
          List<APIReusableComponent>()
        )
        return state.set(
          data.workspaceId,
          reusableComponents.filter((rc) => rc.id !== data.componentId)
        )
      })
    }
    socket.on('workspace-component-removed', onReusableComponentRemoved)

    return () => {
      socket.off('workspace-components', onReusableComponents)
      socket.off('workspace-component-update', onReusableComponentUpdate)
      socket.off('workspace-component-removed', onReusableComponentRemoved)
    }
  }, [socket])

  const create = useCallback(
    async (
      workspaceId: string,
      data: Omit<NewReusableComponent, 'id'> & { id: string },
      documentTitle: string
    ) => {
      // optimistic update
      setState((state) => {
        const reusableComponents = state.get(
          workspaceId,
          List<APIReusableComponent>()
        )
        return state.set(
          workspaceId,
          reusableComponents.push({
            ...data,
            document: {
              id: data.documentId,
              title: documentTitle,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
        )
      })

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/components`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      )

      if (!res.ok) {
        alert('Failed to create reusable component')

        // remove the component from the state
        setState((state) => {
          const reusableComponents = state.get(
            workspaceId,
            List<APIReusableComponent>()
          )
          return state.set(
            workspaceId,
            reusableComponents.filter((rc) => rc.id !== data.id)
          )
        })
      }
    },
    []
  )

  const update = useCallback(
    async (workspaceId: string, id: string, data: UpdateReusableComponent) => {
      const prevComponent = state.get(workspaceId)?.find((rc) => rc.id === id)

      // optimistic update
      setState((state) => {
        const reusableComponents = state.get(
          workspaceId,
          List<APIReusableComponent>()
        )

        const index = reusableComponents.findIndex((rc) => rc.id === id)
        const component = reusableComponents.get(index)
        if (index === -1 || component === undefined) {
          return state
        }

        return state.set(
          workspaceId,
          reusableComponents.set(index, {
            ...component,
            ...data,
            id,
            updatedAt: new Date().toISOString(),
          })
        )
      })

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/components/${id}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      )

      if (!res.ok) {
        // set the component back to the previous state
        if (prevComponent) {
          setState((state) => {
            const components = state.get(
              workspaceId,
              List<APIReusableComponent>()
            )
            const index = components.findIndex((rc) => rc.id === id)
            if (index === -1) {
              return state
            }

            return state.set(workspaceId, components.set(index, prevComponent))
          })
        }

        alert('Failed to update reusable component')
      }
    },
    [state]
  )

  const remove = useCallback(
    async (workspaceId: string, id: string) => {
      const prevComponent = state.get(workspaceId)?.find((rc) => rc.id === id)
      if (!prevComponent) {
        return
      }

      // optimistic update
      setState((state) => {
        const reusableComponents = state.get(
          workspaceId,
          List<APIReusableComponent>()
        )
        return state.set(
          workspaceId,
          reusableComponents.filter((rc) => rc.id !== id)
        )
      })

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/components/${id}`,
        {
          credentials: 'include',
          method: 'DELETE',
        }
      )

      if (!res.ok) {
        alert('Failed to remove reusable component')

        // set the component back to the previous state
        setState((state) => {
          const components = state.get(
            workspaceId,
            List<APIReusableComponent>()
          )
          return state.set(
            workspaceId,
            components.push(prevComponent as APIReusableComponent)
          )
        })
      }
    },
    [state]
  )

  const value: [State, API] = useMemo(
    () => [
      state,
      {
        create,
        update,
        remove,
      },
    ],
    [state, create, update, remove]
  )

  return <Context.Provider value={value}>{props.children}</Context.Provider>
}
