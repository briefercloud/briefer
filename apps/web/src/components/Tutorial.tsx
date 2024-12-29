import useTutorial, { TutorialStepStatus } from '@/hooks/useTutorial'
import { OnboardingTutorialStep } from '@briefer/types'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useEffect, useMemo, useRef } from 'react'
import React from 'react'

const onboardingStepIds: OnboardingTutorialStep[] = [
  'connectDataSource',
  'runQuery',
  'createVisualization',
  'publishDashboard',
  'inviteTeamMembers',
]

export const OnboardingTutorial = (props: { workspaceId: string }) => {
  const [{ stepStates }, { advanceTutorial }] = useTutorial(
    props.workspaceId,
    'onboarding',
    onboardingStepIds
  )

  return (
    <Tutorial name={'Welcome to Briefer'} onAdvanceTutorial={advanceTutorial}>
      <TutorialStep
        name={'Connect a data source'}
        description={
          "Click on 'data sources' at the bottom left corner. Then, click the add data source button, pick your database type, and enter the connection details."
        }
        status={stepStates['connectDataSource']}
      >
        <TutorialStepAction label="Add a data source" onClick={() => {}} />
        <TutorialStepAction
          label="I'll use the demo data source"
          onClick={() => {}}
        />
      </TutorialStep>

      <TutorialStep
        name={'Run a query'}
        description={
          "Add a query block to your page, select the data source you've just connected (top right corner), and write your query. Then, press the run button to see the results."
        }
        status={stepStates['runQuery']}
      >
        <TutorialStepAction label="Add a query block" onClick={() => {}} />
      </TutorialStep>

      <TutorialStep
        name={'Create a visualization'}
        description={
          'Add a visualization block to your page, select the data frame from your query, and choose the visualization type. Then pick what goes on the x and y axis to see a graph.'
        }
        status={stepStates['createVisualization']}
      >
        <TutorialStepAction
          label="Add a visualization block"
          onClick={() => {}}
        />
      </TutorialStep>

      <TutorialStep
        name={'Publish a dashboard'}
        description={
          "Switch to the dashboard view using the button at the top right corner. Then, drag and drop your notebook's blocks to create a dashboard. When you're done, click the 'publish' button to save your dashboard."
        }
        status={stepStates['publishDashboard']}
      >
        <TutorialStepAction
          label="Switch to dashboard view"
          onClick={() => {}}
        />
        <TutorialStepAction label="Publish the dashboard" onClick={() => {}} />
      </TutorialStep>

      <TutorialStep
        name={'Invite team members'}
        description={
          "Open the users page at the bottom left corner of the sidebar. Then, click the 'add user' button and enter the email of the person you want to invite. They'll receive an email with an invitation link."
        }
        status={stepStates['inviteTeamMembers']}
      >
        <TutorialStepAction label="Open the users page" onClick={() => {}} />
        <TutorialStepAction label="Add a user" onClick={() => {}} />
      </TutorialStep>
    </Tutorial>
  )
}

type TutorialProps = {
  name: string
  children:
    | React.ReactElement<TutorialStepProps>
    | React.ReactElement<TutorialStepProps>[]
  onAdvanceTutorial: () => void
}

export const Tutorial = (props: TutorialProps) => {
  return (
    <div className="absolute bottom-16 right-4 bg-white rounded-lg w-80 z-10 border border-gray-200 font-sans overflow-hidden">
      <div className="bg-gray-50 rounded-t-lg h-12 w-full border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm flex gap-x-2 items-center">
          <span className="text-gray-600 font-medium ">Welcome to Briefer</span>
          <button
            className="text-gray-400 text-xs font-medium inline-block"
            onClick={props.onAdvanceTutorial}
          >
            (0/5)
          </button>
        </div>
        <ChevronDownIcon className="text-gray-400 h-3.5 w-3.5" />
      </div>
      <div className="p-4 flex flex-col gap-y-4 h-80 overflow-auto">
        {React.Children.map(props.children, (child, index) => {
          return React.cloneElement(child, {
            isLast: index === React.Children.count(props.children) - 1,
          })
        })}
      </div>
    </div>
  )
}

const TutorialStepStatusIndicator = (props: {
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

type TutorialStepActionProps = {
  label: string
  onClick: () => void
}

const TutorialStepAction = (props: TutorialStepActionProps) => {
  return (
    <button
      className="text-blue-600 text-xs w-full flex gap-x-1 items-center font-medium"
      onClick={props.onClick}
    >
      <ArrowRightIcon className="h-3 w-3" />
      <span>{props.label}</span>
    </button>
  )
}

type TutorialStepProps = {
  name: string
  description: string
  status: TutorialStepStatus
  isLast?: boolean
  children?:
    | React.ReactElement<TutorialStepActionProps>
    | React.ReactElement<TutorialStepActionProps>[]
}

const TutorialStep = (props: TutorialStepProps) => {
  const stepRef = useRef<HTMLLIElement>(null)

  // focus on the current step when it changes
  useEffect(() => {
    if (props.status === 'current') {
      const stepElement = stepRef.current
      stepElement?.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'center',
      })
    }
  }, [props.status])

  return (
    <li className="relative flex gap-x-2" ref={stepRef}>
      <TutorialStepStatusIndicator
        status={props.status}
        isLast={props.isLast ?? false}
      />

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
            'flex flex-col gap-y-3 transition-max-height duration-500 overflow-hidden',
            props.status !== 'current' ? 'max-h-0' : 'max-h-72',
            props.status === 'current' ? 'delay-600' : 'delay-0'
          )}
        >
          <div className="text-xs text-gray-500">{props.description}</div>

          <div className="text-blue-600 text-xs w-full flex flex-col gap-y-1">
            {props.children}
          </div>
        </div>
      </div>
    </li>
  )
}
