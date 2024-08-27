import { EyeIcon, EyeSlashIcon } from '@heroicons/react/20/solid'
import { MouseEventHandler, useCallback } from 'react'

interface Props {
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: () => void
  hasMultipleTabs: boolean
}
function HiddenInPublishedButton(props: Props) {
  const onToggle: MouseEventHandler<HTMLButtonElement> = useCallback(
    (e) => {
      e.stopPropagation()
      props.onToggleIsBlockHiddenInPublished()
    },
    [props.onToggleIsBlockHiddenInPublished]
  )
  return (
    <button
      onClick={onToggle}
      className="rounded-sm border border-gray-200 h-6 min-w-6 flex items-center justify-center relative group hover:bg-gray-50"
    >
      {props.isBlockHiddenInPublished ? (
        <EyeIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500" />
      ) : (
        <EyeSlashIcon className="w-3 h-3 text-gray-400 group-hover:text-gray-500" />
      )}
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1 max-w-40">
        <span className="inline-flex items-center text-gray-400">
          {props.isBlockHiddenInPublished ? 'Show' : 'Hide'} this{' '}
          {props.hasMultipleTabs ? 'tab' : 'block'} on the published page.
        </span>
      </div>
    </button>
  )
}

export default HiddenInPublishedButton
