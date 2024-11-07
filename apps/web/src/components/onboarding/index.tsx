import { Fragment, useCallback, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import OnboardingSteps, {
  ONBOARDING_STEP_CHAIN,
  useOnboardingSteps,
} from './onboardingSteps'
import { ArrowRightIcon, CheckIcon } from '@heroicons/react/24/solid'
import {
  ActivateTrialStep,
  DataSourceStep,
  JoinSlackStep,
  WelcomeStep,
} from './steps'
import { OnboardingStep } from '@briefer/types'

const getCurrentStepContent = (
  currentStepId: OnboardingStep | undefined
): React.FC<{
  currentStepId: OnboardingStep
  goToStep: (stepId: OnboardingStep) => void
}> | null => {
  if (!currentStepId) {
    return WelcomeStep
  }

  switch (currentStepId) {
    case 'intro':
      return WelcomeStep
    case 'connectDataSource':
      return DataSourceStep
    case 'activateTrial':
      return ActivateTrialStep
    case 'joinSlack':
    case 'done':
      return JoinSlackStep
    default:
      return null
  }
}

function Onboarding() {
  const [open, setOpen] = useState(true)

  const { currentStepId, isLoading, goToStep, nextStep, prevStep } =
    useOnboardingSteps()

  const StepContent = getCurrentStepContent(currentStepId)

  const isFirstStep = ONBOARDING_STEP_CHAIN[0].id === currentStepId
  const isLastStep =
    ONBOARDING_STEP_CHAIN[ONBOARDING_STEP_CHAIN.length - 1].id === currentStepId

  const onNextStep = useCallback(() => {
    if (isLastStep) {
      setOpen(false)
    }

    nextStep()
  }, [isLastStep, nextStep])

  return (
    <Transition.Root
      show={open && !isLoading && currentStepId !== 'done'}
      as={Fragment}
    >
      <Dialog className="relative z-[1000]" onClose={() => null}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all max-w-2xl">
                <div className="flex items-start h-full divide-x divide-gray-200">
                  <div className="p-6 min-w-40">
                    <OnboardingSteps
                      currentStepId={currentStepId ?? 'intro'}
                      goToStep={goToStep}
                    />
                  </div>

                  <div className="flex flex-col justify-between h-full py-6 px-8 w-[96rem] overflow-auto">
                    {StepContent && (
                      <StepContent
                        currentStepId={currentStepId ?? 'intro'}
                        goToStep={goToStep}
                      />
                    )}

                    <div className="flex flex-row-reverse gap-x-3 pt-6">
                      <button
                        type="button"
                        data-autofocus
                        className="inline-flex items-center gap-x-3 w-full justify-center rounded-sm bg-primary-200 px-4 py-2 text-sm shadow-sm hover:bg-primary-300 sm:w-auto"
                        onClick={onNextStep}
                      >
                        {isLastStep ? 'Finish' : 'Next'}
                        {isLastStep ? (
                          <CheckIcon className="w-3 h-3" />
                        ) : (
                          <ArrowRightIcon className="w-3 h-3" />
                        )}
                      </button>
                      {!isFirstStep && (
                        <button
                          type="button"
                          className="inline-flex w-full justify-center rounded-sm bg-white px-4 py-2 text-sm text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                          onClick={prevStep}
                        >
                          Back
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

export default Onboarding
