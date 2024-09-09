import { Fragment, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { CheckIcon, DevicePhoneMobileIcon } from '@heroicons/react/24/outline'

export default function MobileWarning() {
  const [open, setOpen] = useState(window.innerWidth < 768)

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog className="relative z-[99999]" onClose={setOpen}>
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all my-auto">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 -rotate-6">
                    <DevicePhoneMobileIcon
                      className="h-6 w-6 text-yellow-700"
                      aria-hidden="true"
                    />
                  </div>
                  <div className="mt-4 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Briefer works best on desktop
                    </Dialog.Title>
                    <div className="mt-4 text-sm text-gray-500 flex flex-col gap-y-4">
                      <p>
                        Hey there! We love mobile too, but Briefer works best on
                        desktop resolutions.
                      </p>
                      <p>
                        It&apos;s a bit cramped in here, so we recommend you
                        switch to a larger screen for the best experience.
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <button
                    type="button"
                    className="border border-primary-400 inline-flex w-full justify-center rounded-sm bg-primary-200 px-3 py-2 text-sm font-semibold shadow-sm hover:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-400 text-gray-700"
                    onClick={() => setOpen(false)}
                  >
                    I want to stay on mobile
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
