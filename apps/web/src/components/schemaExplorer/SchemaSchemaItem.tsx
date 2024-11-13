import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ScrollBar from '../ScrollBar'
import { ShapesIcon } from 'lucide-react'
import { DataSourceSchema } from '@briefer/types'
import { useCallback } from 'react'

interface Props {
  name: string
  schema: DataSourceSchema
  isOpen: boolean
  onToggle: (schema: string) => void
}
function SchemaSchemaItem(props: Props) {
  const onToggle = useCallback(() => {
    props.onToggle(props.name)
  }, [props.onToggle, props.name])
  return (
    <button
      key={props.name}
      className="px-3.5 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full font-normal"
      onClick={onToggle}
    >
      <div className="flex gap-x-1.5 items-center overflow-hidden">
        <ShapesIcon className="h-3.5 w-3.5 text-gray-400" />
        <ScrollBar className="text-left overflow-auto horizontal-only whitespace-nowrap flex-auto">
          <h4>{props.name}</h4>
        </ScrollBar>
      </div>
      <div className="pl-1">
        {props.isOpen ? (
          <ChevronDownIcon className="h-3 w-3 text-gray-500" />
        ) : (
          <ChevronRightIcon className="h-3 w-3 text-gray-500" />
        )}
      </div>
    </button>
  )
}

export default SchemaSchemaItem
