import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { StepStates, TutorialState } from '@briefer/types'
import { useCallback, useEffect, useMemo } from 'react'
import useSWR from 'swr'
import useWebsocket from './useWebsocket'

type UseTutorialState = {
  tutorialState: TutorialState
  isLoading: boolean
}

type UseTutorialAPI = {
  advanceTutorial: () => void
  dismissTutorial: () => void
}

const useTutorial = (
  workspaceId: string,
  tutorialType: string,
  defaultStepStates: StepStates
): [UseTutorialState, UseTutorialAPI] => {
  const socket = useWebsocket()
  const { data, isLoading, error, mutate } = useSWR<TutorialState>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}`,
    fetcher
  )

  const defaultData = useMemo(
    () => ({
      id: '',
      isCompleted: false,
      isDismissed: false,
      stepStates: defaultStepStates,
    }),
    [defaultStepStates]
  )

  useEffect(() => {
    if (!socket) {
      return
    }

    const onTutorialUpdate = (msg: { tutorialState: TutorialState }) => {
      mutate(msg.tutorialState)
    }

    socket.on('workspace-tutorial-update', onTutorialUpdate)

    return () => {
      socket.off('workspace-tutorial-update', onTutorialUpdate)
    }
  }, [socket, mutate])

  const advanceTutorial = useCallback(async () => {
    try {
      const tutorialRes = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }
      )

      return tutorialRes.json()
    } catch (err) {
      alert('Something went wrong')
      return null
    }
  }, [workspaceId, tutorialType])

  const dismissTutorial = useCallback(async () => {
    mutate(
      async () => {
        try {
          const tutorialRes = await fetch(
            `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}/dismiss`,
            {
              credentials: 'include',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            }
          )

          return tutorialRes.json()
        } catch (err) {
          alert('Something went wrong')
          return null
        }
      },
      { optimisticData: { ...defaultData, isDismissed: true } }
    )
  }, [workspaceId, tutorialType, defaultData, mutate])

  return [
    {
      tutorialState: data ?? defaultData,
      isLoading: isLoading || (!data && !error),
    },
    { advanceTutorial, dismissTutorial },
  ]
}

export default useTutorial
