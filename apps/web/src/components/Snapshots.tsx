import * as dfns from 'date-fns'
import React from 'react'
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import { Transition } from '@headlessui/react'
import { QuestionMarkCircleIcon } from '@heroicons/react/20/solid'
import { Tooltip } from './Tooltips'

interface Props {
  workspaceId: string
  documentId: string
  visible: boolean
  onHide: () => void
  isPublished: boolean
}
export default function Snapshots(props: Props) {
  return (
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
        <div className="flex items-center justify-between border-b p-6">
          <div className="flex items-center">
            <h3 className="text-lg font-medium leading-6 text-gray-900 pr-1.5">
              Snapshots
            </h3>
            <div className="group relative">
              <QuestionMarkCircleIcon className="w-4 h-4 text-gray-300" />

              <DefaultSnapshotsTooltip />
            </div>
          </div>

          <Tooltip
            title="Snapshots are not available in the open-source version"
            message="Upgrade to the Briefer cloud's professional tier to use them."
            className="flex"
            tooltipClassname="-bottom-1 right-0 translate-y-full translate-x-0 w-64 text-center"
            position="manual"
            active
          >
            <button
              className="flex items-center gap-x-2 rounded-sm bg-primary-200 px-3 py-1 text-sm hover:bg-primary-300 disabled:cursor-not-allowed disabled:bg-gray-200"
              disabled
            >
              Save
            </button>
          </Tooltip>
        </div>
        <ul
          role="list"
          className="flex-1 divide-y divide-solid overflow-y-scroll"
        ></ul>
      </div>
    </Transition>
  )
}

export function formatSnapshotDate(date: string): string {
  return dfns.format(new Date(date), "do 'of' MMMM, yyyy 'at' h:mm a")
}

const DefaultSnapshotsTooltip = () => {
  return (
    <div className="scale-0 font-sans pointer-events-none absolute left-1/2 mt-1.5 -translate-x-1/2 opacity-0 transition-opacity group-hover:scale-100 group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 w-44">
      <div className="flex flex-col items-center justify-center text-gray-400 text-center gap-y-1">
        <span>Each scheduled run generates a snapshot.</span>
        <span>Create snapshots manually by clicking the save button.</span>
      </div>
    </div>
  )
}
