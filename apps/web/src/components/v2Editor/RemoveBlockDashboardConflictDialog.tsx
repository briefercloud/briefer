import * as Y from 'yjs'
import { useCallback, useEffect, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import * as R from 'ramda'
import {
  ExclamationTriangleIcon,
  InformationCircleIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline'
import {
  RemoveBlockGroupDashboardConflictResult,
  removeBlockGroup,
} from '@briefer/editor'

interface Props {
  yDoc: Y.Doc
  state: RemoveBlockGroupDashboardConflictResult | null
  onClose: () => void
}
function RemoveBlockDashboardConflictDialog(props: Props) {
  const [state, setState] = useState(props.state)
  useEffect(() => {
    if (props.state && !R.equals(state, props.state)) {
      setState(props.state)
    }
  }, [props.state])

  const onConfirm = useCallback(() => {
    if (!state) {
      return
    }

    removeBlockGroup(props.yDoc, state.blockGroupId, true)
    props.onClose()
  }, [props.yDoc, state, props.onClose])

  return (
    <Transition show={props.state !== null}>
      <Dialog onClose={props.onClose} className="relative z-[100]">
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                    <Squares2X2Icon
                      aria-hidden="true"
                      className="h-6 w-6 text-blue-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <div className="mt-2 text-sm text-gray-900">
                      {state?.tabRefs.length === 1 ? (
                        <span>
                          <span className="font-bold">
                            This block is in your dashboard.
                          </span>{' '}
                          Removing it from the notebook will remove it from the
                          dashboard too.
                        </span>
                      ) : (
                        <span>
                          <span className="font-semibold">
                            This block contain tabs that are in your dashboard.
                          </span>{' '}
                          Removing those tabs will remove them from the
                          dashboard too.
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-primary-200 px-3 py-2 text-sm text-gray-900 font-medium hover:bg-primary-300 sm:col-start-1 sm:mt-0"
                  >
                    Continue
                  </button>
                  <button
                    type="button"
                    data-autofocus
                    onClick={props.onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-2 sm:mt-0"
                  >
                    Cancel
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

export default RemoveBlockDashboardConflictDialog
