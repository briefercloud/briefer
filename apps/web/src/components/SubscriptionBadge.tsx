import clsx from 'clsx'
import { Fragment, useMemo, useRef, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon, TicketIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { HeartIcon, SparklesIcon } from '@heroicons/react/24/solid'

type PlanName = 'open-source' | 'free' | 'trial' | 'professional'

const statusColors = {
  free: 'bg-gray-100 text-gray-600 ring-gray-500/10 hover:bg-gray-200',
  trial: 'bg-yellow-50 text-yellow-800 ring-yellow-600/20 hover:bg-yellow-100',
  professional: 'bg-blue-50 text-blue-700 ring-blue-600/20 hover:bg-blue-100',
  'open-source': 'bg-green-50 text-green-700 ring-green-600/20',
}

export const SubscriptionBadge = ({
  planName: status,
}: {
  planName: PlanName
}) => {
  const text: string | JSX.Element = (() => {
    switch (status) {
      case 'free':
        return 'Free plan'
      case 'trial':
        return 'Trial active'
      case 'professional':
        return 'Professional'
      case 'open-source':
        return (
          <div className="flex items-center space-x-1 justify-center group">
            <span>Briefer</span>
            <span className="group-hover:scale-125 transform transition-transform">
              ♥
            </span>
            <span>OSS</span>
          </div>
        )
    }
  })()

  const icon: JSX.Element | null = (() => {
    if (status === 'open-source') {
      return null
    }

    if (status === 'professional') {
      return (
        <span className="">
          <SparklesIcon className="h-3 w-3 -rotate-6 scale-100 group-hover:scale-125 transition-transform" />
        </span>
      )
    }

    return (
      <span className="">
        <TicketIcon className="h-3 w-3 -rotate-12 group-hover:rotate-12 transition-transform" />
      </span>
    )
  })()

  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          'inline-flex items-center justify-between rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset gap-x-1.5 font-sans group',
          statusColors[status]
        )}
      >
        {icon}
        <span className="">{text}</span>
      </button>
      <FeaturesDialog open={open} setOpen={setOpen} currentPlan={status} />
    </>
  )
}

export function FeaturesDialog({
  open,
  setOpen,
  currentPlan,
}: {
  open: boolean
  setOpen: (open: boolean) => void
  currentPlan: PlanName
}) {
  const cancelButtonRef = useRef(null)

  const title = useMemo(() => {
    switch (currentPlan) {
      case 'free':
        return 'Unlock extra features with the professional plan'
      case 'trial':
        return 'You have trial access to extra features'
      case 'professional':
        return 'You have access to extra features and seats'
      case 'open-source':
        return "You're using Briefer's open source version"
    }
  }, [currentPlan])

  const description = useMemo(() => {
    switch (currentPlan) {
      case 'free':
        return (
          <div className="flex flex-col gap-y-2">
            <p>{'Hey, if the free plan suits your needs, that’s great!'}</p>
            <p>
              Anyway, if you need more, you can always upgrade to the
              professional plan.
            </p>
          </div>
        )
      case 'trial':
        return (
          <p>
            You have trial access to all the extra features of the professional
            plan.
          </p>
        )
      case 'professional':
        return (
          <p>
            {
              "We're glad to have you on board! You have access to all the extra features of the professional plan."
            }
          </p>
        )
      case 'open-source':
        return (
          <div className="flex flex-col gap-y-2">
            <p>
              {
                "Briefer's open-source version includes all the main features of Briefer, like SQL, Python, Scheduling, and more."
              }
            </p>
            <p>
              {
                'If you need more granular permissions, PDF exports, embedded graphs, or integrations, please consider upgrading to the professional plan.'
              }
            </p>
          </div>
        )
    }
  }, [currentPlan])

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        className="relative z-[1000]"
        initialFocus={cancelButtonRef}
        onClose={setOpen}
      >
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl sm:p-6">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                    {currentPlan !== 'open-source' ? (
                      <TicketIcon
                        className="h-6 w-6 text-green-600 -rotate-12 animate-wiggle"
                        aria-hidden="true"
                      />
                    ) : (
                      <HeartIcon
                        className="h-6 w-6 text-green-600 animate-heart-pulse"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="mt-2 text-center sm:mt-5">
                    <Dialog.Title
                      as="h2"
                      className="text-lg font-semibold leading-6 text-gray-900"
                    >
                      {title}
                    </Dialog.Title>
                    <div className="pt-4 pb-2 text-sm text-gray-500 flex flex-col gap-y-6">
                      {description}

                      <FeatureTable currentPlan={currentPlan} />

                      {currentPlan === 'trial' && (
                        <p>
                          Don&apos;t worry! Once your trial period ends, you
                          will still have access to Briefer&apos;s free plan.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-sm bg-primary-300 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-primary-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 sm:col-start-2 border border-primary-600"
                    onClick={() => {
                      setOpen(false)
                      window.open('https://briefer.cloud/pricing')
                    }}
                  >
                    Upgrade
                  </button>
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                    onClick={() => setOpen(false)}
                    ref={cancelButtonRef}
                  >
                    Close
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  )
}

type Plan = {
  memory: string
  cpu: string
  editorSeats: string
  viewerSeats: string
  schedules: string
  snapshots: boolean
  pdfExport: boolean
  slackIntegration: boolean
  granularPermissions: boolean
}

const features: (keyof Plan)[] = [
  'memory',
  'cpu',
  'editorSeats',
  'viewerSeats',
  'schedules',
  'snapshots',
  'pdfExport',
  'slackIntegration',
  'granularPermissions',
]

const prettyFeatures: Record<keyof Plan, string> = {
  memory: 'Memory',
  cpu: 'CPU',
  editorSeats: 'Editor seats',
  viewerSeats: 'Viewer seats',
  schedules: 'Scheduled runs',
  snapshots: 'Snapshots',
  pdfExport: 'PDF export',
  slackIntegration: 'Slack integration',
  granularPermissions: 'Granular permissions',
}

const plans: Record<PlanName, Plan> = {
  free: {
    memory: '4 GiB',
    cpu: '1 vCPU',
    editorSeats: '2 editor seats',
    viewerSeats: '10 viewer seats',
    schedules: '1 scheduled run',
    snapshots: false,
    pdfExport: false,
    slackIntegration: false,
    granularPermissions: false,
  },
  'open-source': {
    memory: 'Local resource',
    cpu: 'Local resource',
    editorSeats: 'Unlimited (free)',
    viewerSeats: 'Unlimited viewer seats (free)',
    schedules: 'Unlimited scheduled runs',
    snapshots: true,
    pdfExport: false,
    slackIntegration: false,
    granularPermissions: false,
  },
  professional: {
    memory: '8 GiB',
    cpu: '2 vCPU',
    editorSeats: 'Unlimited (fixed price per seat)',
    viewerSeats: 'Unlimited viewer seats (free)',
    schedules: 'Unlimited scheduled runs',
    snapshots: true,
    pdfExport: true,
    slackIntegration: true,
    granularPermissions: true,
  },
  trial: {
    memory: '8 GiB',
    cpu: '2 vCPU',
    editorSeats: 'Unlimited (fixed price per seat)',
    viewerSeats: 'Unlimited viewer seats (free)',
    schedules: 'Unlimited scheduled runs',
    snapshots: true,
    pdfExport: true,
    slackIntegration: true,
    granularPermissions: true,
  },
}

export function FeatureTable({ currentPlan }: { currentPlan: PlanName }) {
  return (
    <div className="text-left">
      <div className="-mx-4 ring-1 ring-gray-300 sm:mx-0 sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-300">
          <thead>
            <tr>
              <th
                scope="col"
                className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6 border-r border-gray-200 bg-gray-50 rounded-tl-lg"
              >
                Features
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell text-center border-r border-gray-200 bg-gray-50"
              >
                {currentPlan === 'open-source'
                  ? 'Open source'
                  : 'Community tier'}{' '}
                {currentPlan === 'free' ||
                  (currentPlan === 'open-source' && (
                    <span className="text-primary-600">(current)</span>
                  ))}
              </th>
              <th
                scope="col"
                className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 lg:table-cell text-center bg-gray-50 rounded-tr-lg"
              >
                Professional plan{' '}
                {currentPlan === 'trial' && (
                  <span className="text-primary-600">(current trial)</span>
                )}
                {currentPlan === 'professional' && (
                  <span className="text-primary-600">(current)</span>
                )}
              </th>
            </tr>
          </thead>
          <tbody>
            {features.map((feature, featureIdx) => (
              <tr key={feature}>
                <td
                  className={clsx(
                    featureIdx === 0 ? '' : 'border-t border-t-transparent',
                    featureIdx === features.length - 1 ? 'rounded-bl-lg' : '',
                    'relative py-2.5 pl-4 pr-3 text-sm sm:pl-6 border-r bg-gray-50'
                  )}
                >
                  <div className="font-medium text-gray-900">
                    {prettyFeatures[feature]}
                  </div>
                  {featureIdx !== 0 ? (
                    <div className="absolute -top-px left-0 right-0 h-px bg-gray-200" />
                  ) : null}
                </td>
                <td
                  className={clsx(
                    featureIdx === 0 ? '' : 'border-t border-gray-200',
                    'hidden px-3 py-2 text-sm text-gray-500 lg:table-cell text-center border-r'
                  )}
                >
                  {typeof plans[currentPlan][feature] === 'boolean' ? (
                    <div className="w-full flex items-center justify-center">
                      {plans[currentPlan][feature] ? (
                        <CheckIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XMarkIcon className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  ) : (
                    plans[currentPlan][feature]
                  )}
                </td>
                <td
                  className={clsx(
                    featureIdx === 0 ? '' : 'border-t border-gray-200',
                    'relative py-2 pl-3 pr-4 text-sm font-medium sm:pr-6 text-center'
                  )}
                >
                  {typeof plans['professional'][feature] === 'boolean' ? (
                    <div className="w-full flex items-center justify-center">
                      {plans['professional'][feature] ? (
                        <CheckIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <XMarkIcon className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                  ) : (
                    plans['professional'][feature]
                  )}

                  {featureIdx !== 0 ? (
                    <div className="absolute -top-px left-0 right-6 h-px bg-gray-200" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
