import ScrollBar from '../ScrollBar'
import { DataSourceColumn } from '@briefer/types'

interface Props {
  schemaName: string
  tableName: string
  column: DataSourceColumn
}
function ColumnSchemaItem(props: Props) {
  return (
    <div className="pl-12 pr-4 first:pt-1 pt-1.5 pb-1.5 hover:bg-gray-50 flex items-center justify-between">
      <div className="flex-auto overflow-x-hidden">
        {/* TODO we need to figure out all possible type names to select appropriate icons every time */}
        <ScrollBar
          className="overflow-auto horizontal-only whitespace-nowrap"
          title={props.column.name}
        >
          <h5 className="font-mono text-[11px]">{props.column.name}</h5>
        </ScrollBar>
      </div>
      <div className="uppercase text-[10px] text-gray-400 min-w-16 text-right font-normal">
        {props.column.type}
      </div>
    </div>
  )
}

export default ColumnSchemaItem
