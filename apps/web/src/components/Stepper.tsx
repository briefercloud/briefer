import { CheckIcon, EllipsisHorizontalIcon } from '@heroicons/react/20/solid'
import React, { useCallback } from 'react'
import clsx from 'clsx'

interface StepperProps {
  steps: string[]
  currentStep: number
  onSetStep: (n: number) => void
}

const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onSetStep,
}: StepperProps) => {
  const setStepHandler = useCallback(
    (n: number) => () => onSetStep(n),
    [onSetStep]
  )

  return (
    <div className="py-16 px-8">
      <div className="w-[300px]">
        <div className="flex items-center justify-center">
          {steps.map((_step, index) => {
            const isCurrent = index === currentStep
            const isDone = index < currentStep
            const isLast = index === steps.length - 1

            let circle = <div className="rounded-full h-5 w-5 bg-gray-300" />
            if (isDone) {
              circle = (
                <button
                  className="h-5 w-5 bg-primary-700 rounded-full flex items-center justify-center hover:bg-primary-800"
                  onClick={setStepHandler(index)}
                >
                  <CheckIcon className="h-3 w-3 text-white" />
                </button>
              )
            } else if (isCurrent) {
              circle = (
                <div className="h-5 w-5 bg-gray-300 rounded-full flex items-center justify-center">
                  <EllipsisHorizontalIcon className="h-3 w-3 text-white" />
                </div>
              )
            }

            let line = null
            if (!isLast) {
              line = (
                <div
                  className={clsx(
                    isDone ? 'bg-primary-700' : 'bg-gray-300',
                    'flex-1 h-1 bg-gray-300 px-1'
                  )}
                />
              )
            }

            return (
              <>
                {circle}
                {line}
              </>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default Stepper
