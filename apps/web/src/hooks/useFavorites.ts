import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'

type API = {
  favoriteDocument: (docId: string) => Promise<void>
  unfavoriteDocument: (docId: string, refetch?: boolean) => Promise<void>
}
type UseFavorites = [Set<string>, API]
export const useFavorites = (workspaceId: string): UseFavorites => {
  const { data, mutate } = useSWR<string[]>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/favorites`,
    fetcher
  )

  const favorites = useMemo(() => data ?? [], [data])

  const favoriteDocument = useCallback(
    async (docId: string) => {
      await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${docId}/favorite`,
        {
          credentials: 'include',
          method: 'POST',
        }
      )

      mutate(favorites.concat([docId]))
    },
    [workspaceId, mutate, favorites]
  )

  const unfavoriteDocument = useCallback(
    async (docId: string, refetch = true) => {
      if (refetch) {
        await fetch(
          `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/documents/${docId}/favorite`,
          {
            credentials: 'include',
            method: 'DELETE',
          }
        )
      }

      mutate(
        favorites.filter((dId) => dId !== docId),
        refetch
      )
    },
    [workspaceId, mutate, favorites]
  )

  return useMemo(
    () => [
      new Set(favorites),
      {
        favoriteDocument,
        unfavoriteDocument,
      },
    ],
    [favorites, favoriteDocument, unfavoriteDocument]
  )
}
