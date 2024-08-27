import { EllipsisHorizontalIcon } from '@heroicons/react/24/solid'

const BlockOptions = ({ onClick }: { onClick: () => void }) => {
  return (
    <button
      className="h-5 w-5 text-gray-400 group-hover:opacity-100 opacity-0 transition-opacity duration-200 ease-in-out p-0.5 hover:bg-gray-100 rounded-md"
      onClick={onClick}
    >
      <EllipsisHorizontalIcon />
    </button>
  )
}

export default BlockOptions
