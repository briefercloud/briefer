import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { useCallback, useMemo } from 'react'
import useSWR, { SWRResponse } from 'swr'

type API = {
  save: (added: EnvVar[], remove: string[]) => Promise<void>
}

export type EnvVar = {
  id: string
  name: string
  value: string
}
type UseEnvironmentVariables = [SWRResponse<EnvVar[]>, API]
export const useEnvironmentVariables = (
  workspaceId: string
): UseEnvironmentVariables => {
  const swr = useSWR<EnvVar[]>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/environment-variables`,
    fetcher
  )

  const save = useCallback(
    async (add: EnvVar[], remove: string[]) => {
      await swr.mutate(
        async () => {
          const res = await fetch(
            `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/environment-variables`,
            {
              credentials: 'include',
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ add, remove }),
            }
          )

          return res.json()
        },
        { revalidate: true }
      )
    },
    [workspaceId, swr]
  )

  return useMemo(
    () => [
      swr,
      {
        save,
      },
    ],
    [swr, save]
  )
}
