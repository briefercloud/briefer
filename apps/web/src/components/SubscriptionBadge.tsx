import { Fragment, useRef } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { TicketIcon } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/solid'

type PlanName = 'open-source' | 'free' | 'trial' | 'professional'

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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 w-full max-w-xl p-6">
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
                      className="text-xl font-semibold leading-6 text-gray-900"
                    >
                      {"You're using Briefer's open source version"}
                    </Dialog.Title>
                    <div className="pt-4 pb-2 text-md text-gray-500 flex flex-0 flex-col items-center gap-y-6 px-3">
                      <div className="flex flex-col gap-y-3 text-left">
                        <p>
                          {
                            "Briefer's open-source version includes an unlimited number of seats, pages, and schedules, as well as Python, SQL, and Visualizations."
                          }
                        </p>
                        <p>
                          {
                            'If you need SSO, granular permissions, PDF exports, or integrations, please consider upgrading your plan.'
                          }
                        </p>
                      </div>
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
                    View plans
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
