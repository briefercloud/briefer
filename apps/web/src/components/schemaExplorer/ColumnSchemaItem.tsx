import { useMemo } from 'react'
import ScrollBar from '../ScrollBar'
import { DataSourceColumn } from '@briefer/types'

interface Props {
  search: string
  schemaName: string
  tableName: string
  column: DataSourceColumn
}
function ColumnSchemaItem(props: Props) {
  const parts = useMemo(() => {
    const searchParts = props.search.split('.').filter((s) => s.length > 0)
    let columnSearch = searchParts[0]
    if (searchParts.length <= 1) {
      columnSearch = searchParts[0]
    } else if (
      searchParts.length <= 2 &&
      props.tableName.includes(searchParts[0])
    ) {
      columnSearch = searchParts[1]
    } else if (
      searchParts.length <= 3 &&
      props.schemaName.includes(searchParts[0]) &&
      props.tableName.includes(searchParts[1])
    ) {
      columnSearch = searchParts[2]
    }

    const searchMatch = props.column.name.toLowerCase().indexOf(columnSearch)

    return searchMatch !== -1
      ? [
          props.column.name.slice(0, searchMatch),
          props.column.name.slice(
            searchMatch,
            searchMatch + columnSearch.length
          ),
          props.column.name.slice(searchMatch + columnSearch.length),
        ]
      : [props.column.name, '', '']
  }, [props.search, props.column.name])

  return (
    <div className="gap-x-1.5 pl-12 pr-4 first:pt-1 pt-1.5 pb-1.5 hover:bg-gray-50 flex items-center justify-between">
      <div className="flex gap-x-1.5 items-center overflow-hidden w-full">
        {/* TODO we need to figure out all possible type names to select appropriate icons every time */}
        <ScrollBar
          className="overflow-auto horizontal-only whitespace-nowrap w-full text-left"
          title={props.column.name}
        >
          <h5 className="font-mono text-[11px]">
            <span>{parts[0]}</span>
            <span className="font-semibold">{parts[1]}</span>
            <span>{parts[2]}</span>
          </h5>
        </ScrollBar>
      </div>
      <div className="uppercase text-[10px] text-gray-400 min-w-16 text-right font-normal overflow-hidden w-full">
        <ScrollBar className="overflow-auto horizontal-only whitespace-nowrap">
          {props.column.type}
        </ScrollBar>
      </div>
    </div>
  )
}

export default ColumnSchemaItem
