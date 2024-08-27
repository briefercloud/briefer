import { useStringQuery } from '@/hooks/useQueryArgs'
import { useWorkspaces } from '@/hooks/useWorkspaces'
import { OnboardingStep } from '@briefer/types'
import { CheckCircleIcon } from '@heroicons/react/20/solid'
import { useCallback, useMemo, useState } from 'react'

type StepChainItem = {
  id: OnboardingStep
  name: string
}

export const ONBOARDING_STEP_CHAIN: StepChainItem[] = [
  {
    id: 'intro',
    name: 'Introduction',
  },
  {
    id: 'connectDataSource',
    name: 'Connect a data source',
  },
  {
    id: 'joinSlack',
    name: 'Community and support',
  },
]

function OnboardingSteps({
  currentStepId,
  goToStep,
}: {
  currentStepId: OnboardingStep
  goToStep: (stepId: OnboardingStep) => void
}) {
  const currentStepIndex = useMemo(
    () => ONBOARDING_STEP_CHAIN.findIndex((step) => step.id === currentStepId),
    [currentStepId]
  )

  return (
    <nav className="text-xs pt-1 pb-8 h-full" aria-label="Progress">
      <ol role="list" className="space-y-6 flex flex-col justify-center">
        {ONBOARDING_STEP_CHAIN.map((step, i) => (
          <li key={step.name}>
            {i < currentStepIndex ? (
              <button onClick={() => goToStep(step.id)} className="group">
                <span className="flex items-start">
                  <span className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center">
                    <CheckCircleIcon
                      className="h-full w-full text-primary-600 group-hover:text-primary-800"
                      aria-hidden="true"
                    />
                  </span>
                  <span className="ml-1.5 font-medium text-gray-500 group-hover:text-gray-900 text-left">
                    {step.name}
                  </span>
                </span>
              </button>
            ) : i === currentStepIndex ? (
              <button
                onClick={() => goToStep(step.id)}
                className="flex items-start"
                aria-current="step"
              >
                <span
                  className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center"
                  aria-hidden="true"
                >
                  <span className="absolute h-4 w-4 rounded-full bg-primary-200" />
                  <span className="relative block h-2 w-2 rounded-full bg-primary-600" />
                </span>
                <span className="ml-1.5 font-bold text-primary-600 text-left">
                  {step.name}
                </span>
              </button>
            ) : (
              <button onClick={() => goToStep(step.id)} className="group">
                <div className="flex items-start">
                  <div
                    className="relative flex h-5 w-5 flex-shrink-0 items-center justify-center"
                    aria-hidden="true"
                  >
                    <div className="h-2 w-2 rounded-full bg-gray-300 group-hover:bg-gray-400" />
                  </div>
                  <p className="ml-1.5 font-medium text-gray-500 group-hover:text-gray-900 text-left">
                    {step.name}
                  </p>
                </div>
              </button>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export const useOnboardingSteps = () => {
  const workspaceId = useStringQuery('workspaceId')
  const [workspaces, { updateOnboarding }] = useWorkspaces()
  const isLoading = workspaces.isLoading

  const currentWorkspace = workspaces.data.find(
    (workspace) => workspace.id === workspaceId
  )

  const goToStep = useCallback(
    (stepId: OnboardingStep) => {
      if (!currentWorkspace) {
        return
      }

      updateOnboarding(currentWorkspace.id, stepId)
    },
    [currentWorkspace, updateOnboarding]
  )

  const nextStep = useCallback(() => {
    if (!currentWorkspace) {
      return
    }

    const currentStepIndex = ONBOARDING_STEP_CHAIN.findIndex(
      (step) => step.id === currentWorkspace.onboardingStep
    )

    if (currentStepIndex === ONBOARDING_STEP_CHAIN.length - 1) {
      updateOnboarding(workspaceId, 'done')
      return
    }

    const nextStep = ONBOARDING_STEP_CHAIN[currentStepIndex + 1]
    updateOnboarding(currentWorkspace.id, nextStep.id)
  }, [currentWorkspace, updateOnboarding])

  const prevStep = useCallback(() => {
    if (!currentWorkspace) {
      return
    }

    const currentStepIndex = ONBOARDING_STEP_CHAIN.findIndex(
      (step) => step.id === currentWorkspace.onboardingStep
    )

    if (currentStepIndex === 0) {
      return
    }

    const prevStep = ONBOARDING_STEP_CHAIN[currentStepIndex - 1]
    updateOnboarding(currentWorkspace.id, prevStep.id)
  }, [currentWorkspace, updateOnboarding])

  return {
    isLoading,
    currentStepId: currentWorkspace?.onboardingStep,
    goToStep,
    nextStep,
    prevStep,
  }
}

export default OnboardingSteps
