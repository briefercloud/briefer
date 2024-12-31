import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { StepStates } from '@briefer/types'
import { useCallback, useEffect } from 'react'
import useSWR from 'swr'
import useWebsocket from './useWebsocket'

type UseTutorialState = {
  stepStates: StepStates
  isLoading: boolean
}

type UseTutorialAPI = {
  advanceTutorial: () => void
}

const useTutorial = (
  workspaceId: string,
  tutorialType: string,
  defaultStepStates: StepStates
): [UseTutorialState, UseTutorialAPI] => {
  const socket = useWebsocket()
  const { data, isLoading, error, mutate } = useSWR<StepStates>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}`,
    fetcher
  )

  useEffect(() => {
    if (!socket) {
      return
    }

    const onTutorialUpdate = (msg: { stepStates: StepStates }) => {
      console.log(msg)
      mutate(msg.stepStates)
    }

    socket.on('workspace-tutorial-update', onTutorialUpdate)

    return () => {
      socket.off('workspace-tutorial-update', onTutorialUpdate)
    }
  }, [socket, mutate])

  // TODO: this is temporary - used for testing only
  const advanceTutorial = useCallback(async () => {
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
  }, [workspaceId, tutorialType])

  return [
    {
      stepStates: data ?? defaultStepStates,
      isLoading: isLoading || (!data && !error),
    },
    { advanceTutorial },
  ]
}

export default useTutorial
