import { DataSourceColumn } from '@briefer/types'
import ScrollBar from '../ScrollBar'

interface Props {
  schemaName: string
  tableName: string
  columns: DataSourceColumn[]
  hiddenColumns: Set<string>
}
export default function TableDetails(props: Props) {
  return (
    <ul>
      {props.columns.map(
        (column) =>
          !props.hiddenColumns.has(
            `${props.schemaName}.${props.tableName}.${column.name}`
          ) && (
            <li
              key={column.name}
              className="pl-12 pr-4 first:pt-1 pt-1.5 pb-1.5 hover:bg-gray-50 flex items-center justify-between"
            >
              <div className="flex-auto overflow-x-hidden">
                {/* TODO we need to figure out all possible type names to select appropriate icons every time */}
                <ScrollBar
                  className="overflow-auto horizontal-only whitespace-nowrap"
                  title={column.name}
                >
                  <h5 className="font-mono text-[11px]">{column.name}</h5>
                </ScrollBar>
              </div>
              <div className="uppercase text-[10px] text-gray-400 min-w-16 text-right font-normal">
                {column.type}
              </div>
            </li>
          )
      )}
    </ul>
  )
}
