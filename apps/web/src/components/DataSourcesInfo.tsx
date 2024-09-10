import { useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { InformationCircleIcon } from '@heroicons/react/24/outline'
import { GATEWAY_IP } from '@/utils/info'

export default function DataSourcesInfo({
  showInfo,
  closeInfo,
}: {
  showInfo: boolean
  closeInfo: () => void
}) {
  return (
    <Transition show={showInfo}>
      <Dialog className="relative z-[100]" onClose={closeInfo}>
        <Transition.Child
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
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                    <InformationCircleIcon
                      className="h-6 w-6 text-blue-600"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left flex flex-col gap-y-6">
                    <div className="text-sm text-gray-500 flex flex-col gap-y-1">
                      <Dialog.Title
                        as="h3"
                        className="text-base font-semibold leading-6 text-gray-900"
                      >
                        About data sources
                      </Dialog.Title>
                      <p className="text-sm text-gray-500">
                        Data sources are connections to external databases that
                        you can query in Briefer.
                      </p>
                    </div>

                    <div className="text-sm text-gray-500 flex flex-col gap-y-1">
                      <h4 className="text-base font-semibold leading-6 text-gray-900">
                        Our IP address for your allow-list
                      </h4>
                      <p>
                        Sometimes, you may need to configure your firewall or
                        VPN to allow Briefer to connect to your database.{' '}
                        <span className="font-semibold">
                          Our IP address is{' '}
                          <code className="bg-gray-100 px-1 py-0.5 rounded-md text-red-500">
                            {GATEWAY_IP()}
                          </code>
                        </span>
                        .
                      </p>
                    </div>

                    <div className="text-sm text-gray-500 flex flex-col gap-y-1">
                      <h4 className="text-base font-semibold leading-6 text-gray-900">
                        We keep your data safe
                      </h4>
                      <div className="flex flex-col gap-y-2">
                        <p>
                          Briefer does a lot to protect your data. Besides using
                          industry-standard encryption, we also run penetration
                          tests and audits to ensure our security practices are
                          up to date.
                        </p>
                        <p>
                          If you have any questions about our security
                          practices, please send us an email at
                          contact@briefer.cloud or{' '}
                          <a
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold underline hover:text-gray-600"
                            href="https://calendly.com/lucasfcosta/briefer-intro-call"
                          >
                            book a call here
                          </a>
                          , I&apos;d be happy to walk you through it.
                        </p>
                      </div>
                    </div>

                    <div className="text-sm text-gray-500 flex flex-col gap-y-1">
                      <h4 className="text-base font-semibold leading-6 text-gray-900">
                        Got questions? Talk to us
                      </h4>
                      <p>
                        If you have any questions or need help connecting your
                        data source, please reach out to us at
                        contact@briefer.cloud or{' '}
                        <a
                          rel="noopener noreferrer"
                          target="_blank"
                          className="font-semibold underline hover:text-gray-600"
                          href="https://calendly.com/lucasfcosta/briefer-intro-call"
                        >
                          book a call here
                        </a>
                        .
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 flex flex-row-reverse">
                  <button
                    type="button"
                    className="mt-3 inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:mt-0 sm:w-auto"
                    onClick={closeInfo}
                    data-autofocus
                  >
                    Ok, got it!
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
