import fetcher from '@/utils/fetcher'
import type { ApiWorkspace } from '@briefer/database'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { OnboardingStep } from '@briefer/types'
import { WorkspaceEditFormValues } from '@briefer/types'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

type API = {
  updateSettings: (
    workspaceId: string,
    data: WorkspaceEditFormValues
  ) => Promise<ApiWorkspace>
  updateOnboarding: (
    workspaceId: string,
    onboardingStep: OnboardingStep
  ) => Promise<void>
}
type UseWorkspaces = [{ data: ApiWorkspace[]; isLoading: boolean }, API]
export const useWorkspaces = (): UseWorkspaces => {
  const swrRes = useSWR<ApiWorkspace[]>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces`,
    fetcher
  )

  const updateSettings = useCallback(
    async (workspaceId: string, data: WorkspaceEditFormValues) => {
      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        }
      )
      const workspace: ApiWorkspace = await res.json()
      swrRes.mutate((workspaces) =>
        (workspaces ?? []).map((w) => (w.id === workspace.id ? workspace : w))
      )
      return workspace
    },
    [swrRes]
  )

  const updateOnboarding = useCallback(
    async (workspaceId: string, onboardingStep: OnboardingStep) => {
      await swrRes.mutate(
        async () => {
          const res = await fetch(
            `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/onboarding`,
            {
              credentials: 'include',
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ onboardingStep }),
            }
          )

          const workspace: ApiWorkspace = await res.json()
          return (swrRes.data ?? []).map((w) =>
            w.id === workspace.id ? workspace : w
          )
        },
        {
          revalidate: true,
          optimisticData: swrRes.data?.map((w) => {
            if (w.id === workspaceId) {
              return { ...w, onboardingStep }
            }
            return w
          }),
        }
      )
    },
    [swrRes]
  )

  return useMemo(
    () => [
      { data: swrRes.data ?? [], isLoading: swrRes.isLoading },
      {
        updateSettings,
        updateOnboarding,
      },
    ],
    [swrRes, updateSettings, updateOnboarding]
  )
}
