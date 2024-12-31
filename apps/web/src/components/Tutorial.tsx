import useTutorial from '@/hooks/useTutorial'
import {
  OnboardingTutorialStep,
  StepStates,
  TutorialStepStatus,
} from '@briefer/types'
import {
  ArrowRightIcon,
  CheckCircleIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef } from 'react'
import React from 'react'

const defaultStepStates: StepStates = {
  connectDataSource: 'current',
  runQuery: 'upcoming',
  runPython: 'upcoming',
  createVisualization: 'upcoming',
  publishDashboard: 'upcoming',
  inviteTeamMembers: 'upcoming',
}

export const OnboardingTutorial = (props: { workspaceId: string }) => {
  const router = useRouter()

  const [{ stepStates }, { advanceTutorial }] = useTutorial(
    props.workspaceId,
    'onboarding',
    defaultStepStates
  )

  const [expandedStep, setExpandedStep] = React.useState<
    Map<OnboardingTutorialStep, boolean>
  >(new Map())

  const toggleExpanded = useCallback((step: OnboardingTutorialStep) => {
    setExpandedStep((prev) => {
      const next = new Map(prev)
      next.set(step, !prev.get(step))
      return next
    })
  }, [])

  const isWithinDocumentPage = useMemo(() => {
    return router.pathname.endsWith('/notebook/edit')
  }, [router.pathname])

  return (
    <Tutorial
      name={'Welcome to Briefer'}
      onAdvanceTutorial={advanceTutorial}
      totalSteps={Object.values(stepStates).length}
      completedSteps={
        Object.values(stepStates).filter((s) => s === 'completed').length
      }
    >
      <TutorialStep
        name={'Connect a data source'}
        description={
          <>
            <p>
              {
                "You can connect a database in the 'data sources' page at the bottom left corner."
              }
            </p>
            <p>
              {
                'When adding a data source, pick your database type, and enter the connection details.'
              }
            </p>
          </>
        }
        status={stepStates['connectDataSource']}
        isExpanded={expandedStep.get('connectDataSource') ?? false}
        onExpand={() => toggleExpanded('connectDataSource')}
      >
        <TutorialStepAction
          label="Add a data source"
          onClick={() => {
            router.push(`/workspaces/${props.workspaceId}/data-sources/new`)
          }}
        />
        {/* TODO: Deactivated on open-source
        <TutorialStepAction
          label="I'll use the demo data source"
          onClick={() => {}}
        />
        */}
      </TutorialStep>

      <TutorialStep
        name={'Run a query'}
        description={
          <>
            <p>
              Add a query block to your page, select the data source you've just
              connected, and write your query.
            </p>
            <p>Then, press the run button to see the results.</p>
          </>
        }
        status={stepStates['runQuery']}
        isExpanded={expandedStep.get('runQuery') ?? false}
        onExpand={() => toggleExpanded('runQuery')}
      >
        <TutorialStepAction
          label="Add a query block"
          onClick={() => {}}
          hidden={!isWithinDocumentPage}
        />
      </TutorialStep>

      <TutorialStep
        name={'Run some Python code'}
        description={
          <>
            <p>
              Add a Python block, write some code, and press the run button.
            </p>
            <p>
              Tip: you can manipulate query results with Python. Briefer puts
              every query's result into variable containing a Pandas Data Frame.
            </p>
          </>
        }
        status={stepStates['runPython']}
        isExpanded={expandedStep.get('runPython') ?? false}
        onExpand={() => toggleExpanded('runPython')}
      >
        <TutorialStepAction
          label="Add a Python block"
          onClick={() => {}}
          hidden={!isWithinDocumentPage}
        />
      </TutorialStep>

      <TutorialStep
        name={'Create a visualization'}
        description={
          <>
            <p>
              Add a visualization block to your page, select the data frame from
              your query, and choose the visualization type.
            </p>
            <p>Then pick what goes on the x and y axis to see a graph.</p>
          </>
        }
        status={stepStates['createVisualization']}
        isExpanded={expandedStep.get('createVisualization') ?? false}
        onExpand={() => toggleExpanded('createVisualization')}
      >
        <TutorialStepAction
          label="Add a visualization block"
          onClick={() => {}}
        />
      </TutorialStep>

      <TutorialStep
        name={'Publish a dashboard'}
        description={
          <>
            <p>
              {
                'Switch to the dashboard view using the button at the top right corner.'
              }
            </p>
            <p>
              {
                "Then, drag and drop your notebook's blocks to create a dashboard."
              }
            </p>
            <p>
              {
                " When you're done, click the 'publish' button to save your dashboard."
              }
            </p>
          </>
        }
        status={stepStates['publishDashboard']}
        isExpanded={expandedStep.get('publishDashboard') ?? false}
        onExpand={() => toggleExpanded('publishDashboard')}
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
          <>
            <p>
              {
                "Add users by accessing the users page and clicking the 'add user' button on the top right corner."
              }
            </p>
            <p>
              {
                "Every time you add a user, we'll generate a random password for them. Once they log in, they can change it."
              }
            </p>
          </>
        }
        status={stepStates['inviteTeamMembers']}
        isExpanded={expandedStep.get('inviteTeamMembers') ?? false}
        onExpand={() => toggleExpanded('inviteTeamMembers')}
      >
        <TutorialStepAction
          label="Add a new user"
          onClick={() => {
            router.push(`/workspaces/${props.workspaceId}/users/new`)
          }}
        />
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
  totalSteps: number
  completedSteps: number
}

export const Tutorial = (props: TutorialProps) => {
  return (
    <div className="absolute bottom-16 right-4 bg-white rounded-lg w-80 z-20 border border-gray-200 font-sans overflow-hidden">
      <div className="bg-gray-50 rounded-t-lg h-12 w-full border-b border-gray-200 p-4 flex items-center justify-between">
        <div className="text-sm flex gap-x-2 items-center">
          <span className="text-gray-600 font-medium ">Welcome to Briefer</span>
          <button
            className="text-gray-400 text-xs font-medium inline-block"
            onClick={props.onAdvanceTutorial}
          >
            ({props.completedSteps}/{props.totalSteps})
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
  hidden?: boolean
  onClick: () => void
}

const TutorialStepAction = (props: TutorialStepActionProps) => {
  if (props.hidden) {
    return null
  }

  return (
    <button
      className="text-blue-600 text-xs w-full flex gap-x-1 items-center font-medium hover:text-blue-800"
      onClick={props.onClick}
    >
      <ArrowRightIcon className="h-3 w-3" />
      <span>{props.label}</span>
    </button>
  )
}

type TutorialStepProps = {
  name: string
  description: string | React.ReactNode
  status: TutorialStepStatus
  isExpanded: boolean
  onExpand: () => void
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
      const clock = setTimeout(
        () =>
          stepElement?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center',
          }),
        1200
      )

      return () => {
        clearTimeout(clock)
      }
    }
  }, [props.status])

  return (
    <li className="relative flex gap-x-2" ref={stepRef}>
      <TutorialStepStatusIndicator
        status={props.status}
        isLast={props.isLast ?? false}
      />

      <div className="flex flex-col py-0.5 text-sm w-full flex gap-y-1">
        <button
          disabled={props.status === 'current'}
          onClick={props.onExpand}
          className={clsx(
            'block text-left font-medium',
            props.status === 'current'
              ? 'text-gray-800 hover:text-gray-900'
              : props.status === 'completed'
              ? 'text-green-700 hover:text-green-800'
              : 'text-gray-400 hover:text-gray-500'
          )}
        >
          {props.name}
        </button>
        <div
          className={clsx(
            'flex flex-col gap-y-3 transition-max-height duration-500 overflow-hidden',
            props.status !== 'current' && !props.isExpanded
              ? 'max-h-0'
              : 'max-h-72',
            props.status === 'current' ? 'delay-[1000ms]' : 'delay-[200ms]'
          )}
        >
          <div className="text-xs text-gray-500 flex flex-col gap-y-1.5">
            {props.description}
          </div>

          {props.children && (
            <div
              className={clsx(
                'text-blue-600 text-xs w-full flex flex-col gap-y-1',
                props.status === 'current' ? 'block' : 'hidden'
              )}
            >
              {props.children}
            </div>
          )}
        </div>
      </div>
    </li>
  )
}
