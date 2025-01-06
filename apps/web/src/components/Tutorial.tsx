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
  ChevronUpIcon,
  ForwardIcon,
} from '@heroicons/react/24/solid'
import clsx from 'clsx'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import React from 'react'
import { useTourHighlight } from './TourHighlightProvider'
import { useStringQuery } from '@/hooks/useQueryArgs'

const defaultStepStates: StepStates = {
  connectDataSource: 'current',
  runQuery: 'upcoming',
  runPython: 'upcoming',
  createVisualization: 'upcoming',
  publishDashboard: 'upcoming',
  inviteTeamMembers: 'upcoming',
}

// TODO https://regexlicensing.org/ - can we do something else?
const isDocumentPath = (path: string) => {
  return /\/documents\/[^\/]+\/(notebook|dashboard)(\/[^\/]*)?$/.test(path)
}

export const OnboardingTutorial = () => {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')
  const [, { setSelector, setTourActive }] = useTourHighlight()

  const [{ tutorialState }, { advanceTutorial, dismissTutorial }] = useTutorial(
    workspaceId,
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
    return isDocumentPath(router.pathname)
  }, [router.pathname])

  if (!workspaceId || tutorialState.isDismissed) {
    return null
  }

  const completeButton = (
    <button
      disabled={!tutorialState.isCompleted}
      onClick={() => dismissTutorial()}
      className={
        'text-sm w-full flex gap-x-1.5 items-center justify-center font-medium py-1.5 px-2 rounded-sm disabled:opacity-50 bg-primary-200 hover:bg-primary-300 text-primary-800 border border-primary-400 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-800 disabled:border-gray-400'
      }
    >
      <CheckCircleIcon className="h-4 w-4" />
      <span>Finish</span>
    </button>
  )

  const dismissButton = (
    <button
      className="text-sm w-full flex gap-x-1.5 items-center justify-center font-medium px-2 py-1.5 rounded-sm bg-white hover:bg-gray-50 text-gray-600 border border-gray-200 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400 disabled:border-gray-200"
      disabled={tutorialState.isCompleted}
      onClick={() => {
        advanceTutorial()
      }}
    >
      <ForwardIcon className="h-4 w-4" />
      <span>Skip step</span>
    </button>
  )

  return (
    <Tutorial
      name={'Welcome to Briefer'}
      onAdvanceTutorial={advanceTutorial}
      totalSteps={Object.values(tutorialState.stepStates).length}
      completedSteps={
        Object.values(tutorialState.stepStates).filter((s) => s === 'completed')
          .length
      }
      actionButtons={
        <>
          {dismissButton}
          {completeButton}
        </>
      }
    >
      {({ isTutorialExpanded }) => (
        <>
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
            status={tutorialState.stepStates['connectDataSource']}
            isExpanded={expandedStep.get('connectDataSource') ?? false}
            onExpand={() => toggleExpanded('connectDataSource')}
            isTutorialExpanded={isTutorialExpanded}
            isLast={false}
          >
            <TutorialStepAction
              label="Add a data source"
              onClick={() => {
                router.push(`/workspaces/${workspaceId}/data-sources/new`)
              }}
            />
          </TutorialStep>

          <TutorialStep
            name={'Run a query'}
            description={
              <>
                <p>
                  {
                    "Add a query block to a page, select the data source you've just connected, and write your query."
                  }
                </p>
                <p>Then, press the run button to see the results.</p>
              </>
            }
            status={tutorialState.stepStates['runQuery']}
            isExpanded={expandedStep.get('runQuery') ?? false}
            onExpand={() => toggleExpanded('runQuery')}
            isLast={false}
            isTutorialExpanded={isTutorialExpanded}
          >
            <TutorialStepAction
              label="Add a query block"
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)
                  setSelector('#last-plus-button')
                }, 0)
              }}
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
                {
                  "Tip: you can manipulate query results with Python. Briefer puts every query's result into variable containing a Pandas Data Frame."
                }
              </>
            }
            status={tutorialState.stepStates['runPython']}
            isExpanded={expandedStep.get('runPython') ?? false}
            onExpand={() => toggleExpanded('runPython')}
            isLast={false}
            isTutorialExpanded={isTutorialExpanded}
          >
            <TutorialStepAction
              label="Add a Python block"
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)
                  setSelector('#last-plus-button')
                }, 0)
              }}
              hidden={!isWithinDocumentPage}
            />
          </TutorialStep>

          <TutorialStep
            name={'Create a visualization'}
            description={
              <>
                <p>
                  Add a visualization block to your page, select the data frame
                  from your query, and choose the visualization type.
                </p>
                <p>Then pick what goes on the x and y axis to see a graph.</p>
              </>
            }
            status={tutorialState.stepStates['createVisualization']}
            isExpanded={expandedStep.get('createVisualization') ?? false}
            onExpand={() => toggleExpanded('createVisualization')}
            isLast={false}
            isTutorialExpanded={isTutorialExpanded}
          >
            <TutorialStepAction
              label="Add a visualization block"
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)
                  setSelector('#last-plus-button')
                }, 0)
              }}
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
                    "When you're done, click the 'publish' button to save your dashboard."
                  }
                </p>
              </>
            }
            status={tutorialState.stepStates['publishDashboard']}
            isExpanded={expandedStep.get('publishDashboard') ?? false}
            onExpand={() => toggleExpanded('publishDashboard')}
            isLast={false}
            isTutorialExpanded={isTutorialExpanded}
          >
            <TutorialStepAction
              label="Switch to dashboard view"
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)
                  setSelector('#dashboard-view-button')
                }, 0)
              }}
            />
            <TutorialStepAction
              hidden={!router.pathname.endsWith('/dashboard/edit')}
              label="Publish the dashboard"
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)
                  setSelector('#dashboard-publish-button')
                }, 0)
              }}
            />
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
            status={tutorialState.stepStates['inviteTeamMembers']}
            isExpanded={expandedStep.get('inviteTeamMembers') ?? false}
            onExpand={() => toggleExpanded('inviteTeamMembers')}
            isLast={false}
            isTutorialExpanded={isTutorialExpanded}
          >
            <TutorialStepAction
              label="Add a new user"
              hidden={router.pathname.endsWith('/users/new')}
              onClick={() => {
                // TODO we need a setTimeout here because otherwise the listener
                // within the tour highlight provider will trigger before the
                // element is rendered and will dismiss the tour
                setTimeout(() => {
                  setTourActive(true)

                  if (router.pathname.endsWith('/users')) {
                    setSelector('#add-user-button')
                  } else {
                    setSelector('#users-sidebar-item')
                  }
                }, 0)
              }}
            />
          </TutorialStep>
        </>
      )}
    </Tutorial>
  )
}

type TutorialProps = {
  name: string
  children: (props: {
    isTutorialExpanded: boolean
  }) =>
    | React.ReactElement<TutorialStepProps>
    | React.ReactElement<TutorialStepProps>[]
  onAdvanceTutorial: () => void
  totalSteps: number
  completedSteps: number
  actionButtons?: React.ReactNode
}

export const Tutorial = (props: TutorialProps) => {
  const router = useRouter()
  const [isCollapsed, setIsCollapsed] = useState(false)

  const ChevronIcon = isCollapsed ? ChevronUpIcon : ChevronDownIcon

  const isWithinDocumentPage = useMemo(() => {
    return isDocumentPath(router.pathname)
  }, [router.pathname])

  return (
    <div
      className={clsx(
        'absolute bottom-0 right-4 bg-white rounded-lg w-80 z-30 border border-gray-200 font-sans overflow-hidden shadow-sm transition-transform duration-300',
        isWithinDocumentPage ? '-translate-y-14' : '-translate-y-4'
      )}
    >
      <div
        className={clsx(
          'bg-gray-50 rounded-t-lg h-12 w-full border-gray-200 p-4 flex items-center justify-between',
          isCollapsed ? '' : 'border-b'
        )}
      >
        <div className="text-sm flex gap-x-2 items-center">
          <span className="text-gray-600 font-medium ">Welcome to Briefer</span>
          <button
            className="text-gray-400 text-xs font-medium inline-block"
            onClick={props.onAdvanceTutorial}
          >
            ({props.completedSteps}/{props.totalSteps})
          </button>
        </div>
        <button
          className="text-gray-400 hover:text-gray-800"
          onClick={() => setIsCollapsed((prev) => !prev)}
        >
          <ChevronIcon className="h-3.5 w-3.5" />
        </button>
      </div>
      <div
        className={clsx(
          'transition-max-height duration-300',
          isCollapsed ? 'max-h-0' : 'max-h-96'
        )}
      >
        <div className={clsx('h-72 overflow-auto')}>
          <div className="flex flex-col gap-y-4 p-4">
            {props.children({ isTutorialExpanded: !isCollapsed })}
          </div>
        </div>
        <div className="w-full bg-gray-50 p-2 flex items-center justify-center gap-x-2 border-t border-gray-200">
          {props.actionButtons}
        </div>
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
  isLast: boolean
  isTutorialExpanded: boolean
  children?:
    | React.ReactElement<TutorialStepActionProps>
    | React.ReactElement<TutorialStepActionProps>[]
}

const TutorialStep = (props: TutorialStepProps) => {
  const stepRef = useRef<HTMLLIElement>(null)

  // focus on the current step when it changes
  useEffect(() => {
    if (props.status === 'current' && props.isTutorialExpanded) {
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
  }, [props.status, props.isTutorialExpanded])

  return (
    <li className="relative flex gap-x-2" ref={stepRef}>
      <TutorialStepStatusIndicator
        status={props.status}
        isLast={props.isLast ?? false}
      />

      <div className="flex flex-col py-0.5 text-sm w-full flex gap-y-1">
        <button
          disabled={props.status === 'current'}
          onClick={stepRef.current ? props.onExpand : () => {}}
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
