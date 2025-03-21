import { Grid3x3Icon } from 'lucide-react'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import ScrollBar from '../ScrollBar'
import { useCallback, useMemo } from 'react'
import { DataSourceTable } from '@briefer/types'

interface Props {
  search: string
  schemaName: string
  name: string
  table: DataSourceTable
  isOpen: boolean
  onToggle: (schema: string, table: string) => void
}
function TableSchemaItem(props: Props) {
  const parts = useMemo(() => {
    const searchParts = props.search.split('.').filter((s) => s.length > 0)
    let tableSearch = searchParts[0]
    if (searchParts.length > 1 && props.schemaName.includes(searchParts[0])) {
      tableSearch = searchParts[1]
    }

    const searchMatch = props.name.toLowerCase().indexOf(tableSearch)

    return searchMatch !== -1
      ? [
          props.name.slice(0, searchMatch),
          props.name.slice(searchMatch, searchMatch + tableSearch.length),
          props.name.slice(searchMatch + tableSearch.length),
        ]
      : [props.name, '', '']
  }, [props.search, props.name])

  const onToggle = useCallback(() => {
    props.onToggle(props.schemaName, props.name)
  }, [props.onToggle, props.schemaName, props.name])

  return (
    <button
      className="pl-6 pr-3.5 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full font-normal"
      onClick={onToggle}
    >
      <div className="flex gap-x-1.5 items-center overflow-hidden w-full">
        <Grid3x3Icon className="text-gray-400 min-h-3.5 min-w-3.5 h-3.5 w-3.5" />
        <ScrollBar
          className="overflow-auto horizontal-only whitespace-nowrap w-full text-left"
          title={props.name}
        >
          <span>{parts[0]}</span>
          <span className="font-semibold">{parts[1]}</span>
          <span>{parts[2]}</span>
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

export default TableSchemaItem
