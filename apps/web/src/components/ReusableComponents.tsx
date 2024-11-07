import * as Y from 'yjs'
import React, { useCallback } from 'react'
import { ChevronDoubleRightIcon, TrashIcon } from '@heroicons/react/24/outline'
import { Transition, Dialog } from '@headlessui/react'
import Spin from './Spin'
import { Tooltip } from './Tooltips'
import { format } from 'date-fns'
import clsx from 'clsx'
import { SaveIcon } from 'lucide-react'
import { useState } from 'react'
import { useReusableComponents } from '@/hooks/useReusableComponents'
import { APIReusableComponent, ReusableComponentType } from '@briefer/database'
import { addComponentToDocument, decodeComponentState } from '@briefer/editor'
import ScrollBar from './ScrollBar'

interface Props {
  workspaceId: string
  visible: boolean
  onHide: () => void
  yDoc?: Y.Doc
}

export default function ReusableComponents(props: Props) {
  const [{ data, isLoading }, api] = useReusableComponents(props.workspaceId)

  const onUse = useCallback(
    (component: APIReusableComponent) => {
      if (!props.yDoc) {
        return
      }

      const block = decodeComponentState(component.state)
      addComponentToDocument(block, props.yDoc)
    },
    [props.yDoc]
  )

  const onRemove = useCallback(
    (component: APIReusableComponent) => {
      api.remove(props.workspaceId, component.id)
    },
    [api, props.workspaceId]
  )

  return (
    <>
      <Transition
        as="div"
        show={props.visible}
        className="top-0 right-0 h-full absolute bg-white z-30"
        enter="transition-transform duration-300"
        enterFrom="transform translate-x-full"
        enterTo="transform translate-x-0"
        leave="transition-transform duration-300"
        leaveFrom="transform translate-x-0"
        leaveTo="transform translate-x-full"
      >
        <button
          className="absolute z-10 top-7 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-gray-100 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
          onClick={props.onHide}
        >
          <ChevronDoubleRightIcon className="w-3 h-3" />
        </button>
        <div className="w-[324px] flex flex-col border-l border-gray-200 h-full bg-white">
          <div className="flex justify-between border-b p-6 space-x-3">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900 pr-1.5">
                Reusable Components
              </h3>
              <p className="text-gray-500 text-sm pt-1">
                {'Click a component to add it to the current page.'}
              </p>
            </div>
          </div>
          <>
            {data.size > 0 || isLoading ? (
              <>
                {isLoading && (
                  <div className="flex items-center justify-center h-full">
                    <Spin />
                  </div>
                )}
                <ScrollBar className="overflow-y-auto">
                  <ul role="list" className="flex-1">
                    {data.map((component) => (
                      <li
                        key={component.id}
                        className={clsx('border-gray-200 border-b')}
                      >
                        <ReusableComponentItem
                          workspaceId={props.workspaceId}
                          component={component}
                          onUse={onUse}
                          onRemove={onRemove}
                          canUse={props.yDoc !== undefined}
                        />
                      </li>
                    ))}
                  </ul>
                </ScrollBar>
              </>
            ) : (
              <div className="flex-1 p-4">
                <div className="flex items-center justify-center h-full text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                  You have no reusable components. Save a block to create one.
                </div>
              </div>
            )}
          </>
        </div>
      </Transition>
    </>
  )
}

function showType(type: ReusableComponentType): string {
  switch (type) {
    case ReusableComponentType.sql:
      return 'SQL'
    case ReusableComponentType.python:
      return 'Python'
  }
}

interface ReusableComponentItemProps {
  workspaceId: string
  component: APIReusableComponent
  onUse: (component: APIReusableComponent) => void
  onRemove: (component: APIReusableComponent) => void
  canUse: boolean
}
function ReusableComponentItem(props: ReusableComponentItemProps) {
  const onUse = useCallback(() => {
    props.onUse(props.component)
  }, [props.onUse, props.component])

  const onRemove = useCallback(() => {
    props.onRemove(props.component)
  }, [props.onRemove, props.component])

  return (
    <div className="px-4 py-3 font-sans block w-full">
      <div className="flex flex-col">
        <div className="flex justify-between">
          <div
            className="font-medium pr-2 text-sm break-all"
            title={props.component.title || 'SQL - Untitled'}
          >
            {props.component.title || 'Untitled'}
          </div>
          <div>
            <button
              className="text-gray-500 hover:text-red-500 disabled:cursor-not-allowed"
              onClick={onRemove}
            >
              <TrashIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-y-1">
          <div className="flex items-center gap-x-2 font-medium text-gray-400 text-xs">
            {showType(props.component.type)}

            <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 fill-current">
              <circle cx={1} cy={1} r={1} />
            </svg>
            {props.component.document.title || 'Untitled'}
          </div>
          <div className="flex items-center gap-x-2 font-medium text-gray-400 text-xs">
            Saved at{' '}
            {format(
              new Date(props.component.updatedAt),
              "h:mm a '-' do MMM, yyyy"
            )}
          </div>
        </div>

        <div className="flex pt-3 text-xs font-medium">
          <Tooltip
            position="manual"
            title=""
            message="You must be in a notebook to use this file."
            active={!props.canUse}
            tooltipClassname="-top-1 w-44 -translate-y-full"
          >
            <button
              className="text-gray-500 hover:text-gray-400 disabled:hover:text-gray-500 disabled:cursor-not-allowed"
              onClick={onUse}
              disabled={!props.canUse}
            >
              Add to notebook
            </button>
          </Tooltip>
          <span className="text-gray-300 px-1">/</span>
        </div>
      </div>
    </div>
  )
}

interface SaveReusableComponentButtonProps {
  isComponent: boolean
  onSave: () => void
  disabled: boolean
  isComponentInstance: boolean
}
export function SaveReusableComponentButton(
  props: SaveReusableComponentButtonProps
) {
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false)
  const onSave = useCallback(() => {
    if (props.isComponent && !isConfirmationModalOpen) {
      setIsConfirmationModalOpen(true)
    } else {
      setIsConfirmationModalOpen(false)
      props.onSave()
    }
  }, [props.isComponent, props.onSave, isConfirmationModalOpen])

  const onCancel = useCallback(() => {
    setIsConfirmationModalOpen(false)
  }, [])

  return (
    <>
      <div className="relative">
        <Tooltip
          position="top"
          message={
            props.isComponentInstance
              ? "You can't save this component because it's an instance of an existing component."
              : 'Save this block as a reusable component to add to other pages.'
          }
          tooltipClassname="w-36"
          active
        >
          <button
            className="rounded-sm h-6 min-w-6 flex items-center justify-center border border-gray-200 text-gray-400 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-300"
            onClick={onSave}
            disabled={props.disabled || props.isComponentInstance}
          >
            <SaveIcon strokeWidth={2} className="w-3 h-3" />
          </button>
        </Tooltip>
      </div>
      <SaveConfirmationModal
        isOpen={isConfirmationModalOpen}
        onClose={onCancel}
        onUpdate={onSave}
      />
    </>
  )
}

interface SaveConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onUpdate: () => void
}
export const SaveConfirmationModal = (props: SaveConfirmationModalProps) => {
  return (
    <Transition show={props.isOpen}>
      <Dialog onClose={props.onClose} className="relative z-[1000]">
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
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all w-[532px]">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                    <SaveIcon
                      strokeWidth={2}
                      className="h-6 w-6 text-yellow-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      Update existing component
                    </Dialog.Title>
                    <div className="mt-2 flex flex-col items-center gap-y-2">
                      <p className="text-sm text-gray-500">
                        You have previously saved this block as a reusable
                        component.
                      </p>

                      <p className="text-sm text-gray-500">
                        Saving this component will update all of its instances.
                      </p>

                      <p className="text-sm text-gray-500">
                        Do you want to update it?
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-2 sm:gap-3">
                  <button
                    type="button"
                    onClick={props.onUpdate}
                    className="inline-flex w-full justify-center rounded-sm bg-primary-200 px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-primary-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:col-start-2"
                  >
                    Update component
                  </button>
                  <button
                    type="button"
                    data-autofocus
                    onClick={props.onClose}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
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
