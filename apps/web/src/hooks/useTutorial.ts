import { NEXT_PUBLIC_API_URL } from '@/utils/env'
import fetcher from '@/utils/fetcher'
import { OnboardingTutorial } from '@briefer/database'
import { OnboardingTutorialStep } from '@briefer/types'
import { useCallback, useEffect, useState } from 'react'
import useSWR from 'swr'

export type TutorialStepStatus = 'current' | 'completed' | 'upcoming'

type StepStates = Record<OnboardingTutorialStep, TutorialStepStatus>

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
  stepIds: OnboardingTutorialStep[]
): [UseTutorialState, UseTutorialAPI] => {
  const { data, isLoading, error, mutate } = useSWR<OnboardingTutorial>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}`,
    fetcher
  )

  const [stepStates, setStepStates] = useState<StepStates>(
    stepIds.reduce((acc, stepId) => {
      acc[stepId] = 'upcoming'
      return acc
    }, {} as StepStates)
  )

  useEffect(() => {
    if (!data) return

    const currentStepIndex = stepIds.indexOf(data.currentStep)

    setStepStates(() =>
      stepIds.reduce((acc, stepId, index) => {
        if (index < currentStepIndex) {
          acc[stepId] = 'completed'
        } else if (index === currentStepIndex) {
          acc[stepId] = 'current'
        } else {
          acc[stepId] = 'upcoming'
        }

        return acc
      }, {} as StepStates)
    )
  }, [data, stepIds])

  const advanceTutorial = useCallback(async () => {
    if (!data) return

    const currentIndex = stepIds.indexOf(data.currentStep)
    const nextStep = stepIds[currentIndex + 1]

    mutate(
      async () => {
        const tutorialRes = await fetch(
          `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/tutorials/${tutorialType}`,
          {
            credentials: 'include',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ currentStep: nextStep }),
          }
        )

        return tutorialRes.json()
      },
      {
        optimisticData: { ...data, currentStep: nextStep },
        rollbackOnError: true,
      }
    )
  }, [data, mutate, stepIds])

  return [
    {
      stepStates,
      isLoading: isLoading || (!data && !error),
    },
    { advanceTutorial },
  ]
}

export default useTutorial
