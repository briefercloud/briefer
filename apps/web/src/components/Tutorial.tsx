import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'
import Link from 'next/link'
import { useMemo } from 'react'

const tutorialSteps = [
  {
    name: 'Connect a data source',
  },
  {
    name: 'Run a query',
  },
  {
    name: 'Create a visualization',
  },
  {
    name: 'Publish a dashboard',
  },
  {
    name: 'Invite team members',
  },
]

const Tutorial = () => {
  return (
    <div className="absolute bottom-16 right-4 bg-white rounded-lg w-80 z-10 border border-gray-200 font-sans overflow-hidden">
      <div className="bg-gray-50 rounded-t-lg h-12 w-full border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm flex gap-x-2 items-center">
          <span className="text-gray-600 font-medium ">Welcome to Briefer</span>
          <span className="text-gray-400 text-xs font-medium">(0/5)</span>
        </div>
        <ChevronDownIcon className="text-gray-400 h-3.5 w-3.5" />
      </div>
      <div className="p-4 flex flex-col gap-y-4 h-80 overflow-auto">
        {tutorialSteps.map((step, index) => (
          <TutorialStep
            key={index}
            name={step.name}
            status={
              index === 1 ? 'current' : index < 1 ? 'completed' : 'upcoming'
            }
            isLast={index === tutorialSteps.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

type TutorialStepStatus = 'current' | 'completed' | 'upcoming'

const TutorialStepStatus = (props: {
  status: TutorialStepStatus
  isLast: boolean
}) => {
  const statusBall = useMemo(() => {
    if (props.status === 'current') {
      return (
        <>
          <div className="absolute size-2.5 rounded-full bg-yellow-300 ring-1 ring-yellow-300 animate-ping" />
          <div className="size-2.5 rounded-full bg-yellow-300 ring-1 ring-yellow-400" />
        </>
      )
    }

    if (props.status === 'completed') {
      return <CheckCircleIcon className="h-4 w-4 text-green-700" />
      return (
        <div className="size-2.5 rounded-full bg-green-600 ring-1 ring-green-600" />
      )
    }

    return (
      <div className="size-2.5 rounded-full bg-gray-100 ring-1 ring-gray-300" />
    )
  }, [props.status])

  return (
    <>
      <div
        className={clsx(
          'absolute left-0 top-1 flex w-6 justify-center -bottom-6',
          props.isLast ? 'hidden' : 'block'
        )}
      >
        <div
          className={clsx(
            'w-px',
            props.status === 'completed' ? 'bg-green-600/40' : 'bg-gray-200'
          )}
        ></div>
      </div>

      <div className="relative flex size-6 flex-none items-center justify-center bg-white">
        {statusBall}
      </div>
    </>
  )
}

type TutorialStepProps = {
  name: string
  status: TutorialStepStatus
  isLast: boolean
}

const TutorialStep = (props: TutorialStepProps) => {
  return (
    <li className="relative flex gap-x-2">
      <TutorialStepStatus status={props.status} isLast={props.isLast} />

      <div className="flex flex-col py-0.5 text-sm w-full flex gap-y-1">
        <div
          className={clsx(
            'font-medium',
            props.status === 'current'
              ? 'text-gray-800'
              : props.status === 'completed'
              ? 'text-green-700'
              : 'text-gray-400'
          )}
        >
          {props.name}
        </div>
        <div
          className={clsx(
            'flex flex-col gap-y-3',
            props.status !== 'current' ? 'hidden' : 'block'
          )}
        >
          <div className="text-xs text-gray-500">
            Click on "data sources" at the bottom left corner. Then, click the
            add data source button, pick your database type, and enter the
            connection details.
          </div>

          <div className="text-blue-600 text-xs w-full flex flex-col gap-y-1">
            <div className="flex gap-x-1 items-center">
              <ArrowRightIcon className="h-3 w-3" />
              <span>Add a data source</span>
            </div>

            <div className="flex gap-x-1 items-center">
              <ArrowRightIcon className="h-3 w-3" />
              <span>I'll use the demo data source</span>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

export default Tutorial
