import { TutorialSteps, TutorialStepStatus } from '@briefer/types'
import { useCallback, useState } from 'react'

const mockSteps: TutorialSteps = {
  'connect-data-source': {
    status: 'current',
  },
  'run-query': {
    status: 'upcoming',
  },
  'create-visualization': {
    status: 'upcoming',
  },
  'publish-dashboard': {
    status: 'upcoming',
  },
  'invite-team-members': {
    status: 'upcoming',
  },
}

type UseTutorialAPI = {
  advanceTutorial: () => void
}

const useTutorial = (): [TutorialSteps, UseTutorialAPI] => {
  const [tutorialSteps, setTutorialSteps] = useState<TutorialSteps>(mockSteps)

  const advanceTutorial = useCallback(() => {
    setTutorialSteps((prevStepState) => {
      const currentStepIndex = Object.keys(prevStepState).findIndex(
        (step) => prevStepState[step].status === 'current'
      )

      if (currentStepIndex === -1) {
        return prevStepState
      }

      return Object.keys(prevStepState).reduce<TutorialSteps>(
        (acc, step, index) => {
          if (index <= currentStepIndex) {
            return { ...acc, [step]: { status: 'completed' } }
          } else if (index === currentStepIndex + 1) {
            return { ...acc, [step]: { status: 'current' } }
          } else {
            return { ...acc, [step]: { status: 'upcoming' } }
          }
        },
        {}
      )
    })
  }, [])

  return [tutorialSteps, { advanceTutorial }]
}

export default useTutorial
