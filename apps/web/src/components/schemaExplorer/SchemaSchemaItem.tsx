import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ScrollBar from '../ScrollBar'
import { ShapesIcon } from 'lucide-react'
import { DataSourceSchema } from '@briefer/types'
import { useCallback, useMemo } from 'react'

interface Props {
  search: string
  name: string
  schema: DataSourceSchema
  isOpen: boolean
  onToggle: (schema: string) => void
}
function SchemaSchemaItem(props: Props) {
  const parts = useMemo(() => {
    const schemaSearch = props.search.split('.')[0]
    const searchMatch = props.name.toLowerCase().indexOf(schemaSearch)

    return searchMatch !== -1
      ? [
          props.name.slice(0, searchMatch),
          props.name.slice(searchMatch, searchMatch + props.search.length),
          props.name.slice(searchMatch + props.search.length),
        ]
      : [props.name, '', '']
  }, [props.search, props.name])

  const onToggle = useCallback(() => {
    props.onToggle(props.name)
  }, [props.onToggle, props.name])

  return (
    <button
      key={props.name}
      className="px-3.5 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full font-normal"
      onClick={onToggle}
    >
      <div className="flex gap-x-1.5 items-center overflow-hidden w-full">
        <ShapesIcon className="h-3.5 w-3.5 text-gray-400" />
        <ScrollBar
          className="overflow-auto horizontal-only whitespace-nowrap w-full text-left"
          title={props.name}
        >
          <h4>
            <span>{parts[0]}</span>
            <span className="font-semibold">{parts[1]}</span>
            <span>{parts[2]}</span>
          </h4>
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
