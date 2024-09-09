import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import type { DataSource } from '@briefer/database'
import { DataSourceStructure } from '@briefer/types'
import { fromPairs } from 'ramda'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'

export type APIDataSource = {
  dataSource: DataSource
  structure: DataSourceStructure
}

export type APIDataSources = APIDataSource[]

type API = {
  ping: (
    id: string,
    type: string
  ) => Promise<{
    lastConnection: string | null
    connStatus: 'online' | 'offline'
  }>
  remove: (id: string) => void
  refresh: () => Promise<void>
}
type UseDataSources = [APIDataSources, boolean, API]
export const useDataSources = (workspaceId: string): UseDataSources => {
  const {
    data: swrData,
    mutate,
    isLoading,
  } = useSWR<{
    dataSources: DataSource[]
    structures: Record<string, DataSourceStructure>
  }>(
    `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/data-sources`,
    fetcher
  )
  const data: APIDataSources = useMemo(() => {
    if (!swrData) {
      return []
    }

    return swrData.dataSources.map((dataSource) => ({
      dataSource,
      structure: swrData.structures[dataSource.data.id] ?? {
        dataSourceId: dataSource.data.id,
        schemas: {},
        defaultSchema: '',
      },
    }))
  }, [swrData])

  const remove = useCallback(
    async (id: string) => {
      await mutate(async (data) => {
        const res = await fetch(
          `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/data-sources/${id}`,
          {
            credentials: 'include',
            method: 'DELETE',
          }
        )

        if (res.ok) {
          if (!data) {
            return
          }

          return {
            dataSources: data.dataSources.filter((ds) => ds.data.id !== id),
            structures: fromPairs(
              Object.entries(data.structures).filter(([dsId]) => dsId !== id)
            ),
          }
        } else {
          // TODO proper error handling
          alert('Failed to remove data source')
        }
      })
    },
    [mutate, data, workspaceId]
  )

  const ping = useCallback(
    async (id: string, type: string) => {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/data-sources/${id}/ping`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ type: type }),
        }
      )

      if (res.status > 299) {
        throw new Error(`Unexpected status code ${res.status}`)
      }

      const resBody = await res.json()
      mutate((data) => {
        if (!data) {
          return
        }

        return {
          dataSources: data.dataSources.map((ds) =>
            ds.data.id === id
              ? {
                  ...ds,
                  connStatus: resBody.connStatus,
                  lastConnection: resBody.lastConnection,
                }
              : ds
          ),
          structures: data.structures,
        }
      })

      return resBody
    },
    [mutate, workspaceId]
  )

  const refresh = useCallback(async () => {
    await mutate()
  }, [mutate])

  return useMemo(
    () => [data, isLoading, { ping, remove, refresh }],
    [data, ping, remove, refresh]
  )
}
