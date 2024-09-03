import fetcher from '@/utils/fetcher'
import type { Workspace } from '@briefer/database'
import { useCallback, useMemo } from 'react'
import useSWR from 'swr'
import { useSession } from './useAuth'
import { OnboardingStep } from '@briefer/types'
type API = {
  updateName: (workspaceId: string, name: string) => Promise<Workspace>
  updateAssistantModel: (
    workspaceId: string,
    modelId: string
  ) => Promise<Workspace>
  updateOnboarding: (
    workspaceId: string,
    onboardingStep: OnboardingStep
  ) => Promise<void>
}
type UseWorkspaces = [{ data: Workspace[]; isLoading: boolean }, API]
export const useWorkspaces = (): UseWorkspaces => {
  const session = useSession()
  const swrRes = useSWR<Workspace[]>(
    `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces`,
    fetcher
  )

  const updateName = useCallback(
    async (workspaceId: string, name: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name,
          }),
        }
      )
      const workspace: Workspace = await res.json()
      swrRes.mutate((workspaces) =>
        (workspaces ?? []).map((w) => (w.id === workspace.id ? workspace : w))
      )
      return workspace
    },
    [swrRes]
  )

  const updateAssistantModel = useCallback(
    async (workspaceId: string, modelId: string) => {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            assistantModel: modelId,
          }),
        }
      )
      const workspace: Workspace = await res.json()
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
            `${process.env.NEXT_PUBLIC_API_URL}/v1/workspaces/${workspaceId}/onboarding`,
            {
              credentials: 'include',
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ onboardingStep }),
            }
          )

          const workspace: Workspace = await res.json()
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
        updateName,
        updateAssistantModel,
        updateOnboarding,
      },
    ],
    [swrRes, updateName, updateOnboarding, updateAssistantModel]
  )
}
