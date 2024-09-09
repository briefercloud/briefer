import { EyeIcon } from '@heroicons/react/24/outline'
import { Tooltip } from './Tooltips'

interface Props {
  onClick: () => void
  disabled: boolean
  tooltipActive: boolean
}
function LiveButton(props: Props) {
  return (
    <Tooltip
      tooltipClassname="w-40"
      title="Page never published"
      message="Publish this page to see a live version."
      position="bottom"
      active={props.tooltipActive}
    >
      <button
        className="flex items-center rounded-sm px-3 py-1 text-sm bg-white hover:bg-gray-100 text-gray-500 border border-gray-200 disabled:cursor-not-allowed disabled:bg-gray-100 group overflow-hidden group max-w-[42px] xl:max-w-[120px] hover:max-w-[120px] transition-mw duration-500"
        onClick={props.onClick}
        disabled={props.disabled}
      >
        <EyeIcon className="min-w-4 min-h-4" />

        <span className="ml-2 opacity-0 group-hover:opacity-100 xl:opacity-100 duration-500 transition-opacity text-clip text-nowrap">
          Live version
        </span>
      </button>
    </Tooltip>
  )
}

export default LiveButton
