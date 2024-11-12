import { DataSourceColumn } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import { useMemo } from 'react'
import Levenshtein from 'levenshtein'

interface Props {
  schemaName: string
  tableName: string
  columns: DataSourceColumn[]
  onCloseTableDetails: () => void
  search: string
}
export default function TableDetails(props: Props) {
  const columns = useMemo(
    () =>
      props.columns.filter(({ name }) => {
        const column =
          `${props.schemaName}.${props.tableName}.${name}`.toLowerCase()

        return (
          props.search.trim() === '' ||
          column
            .trim()
            .toLowerCase()
            .includes(props.search.trim().toLowerCase()) ||
          new Levenshtein(
            column.trim().toLowerCase(),
            props.search.trim().toLowerCase()
          ).distance <=
            column.length / 2
        )
      }),
    [props.columns, props.search]
  )
  return (
    <ul>
      {columns.map((column) => {
        return (
          <li
            key={column.name}
            className="pl-8 pr-4 py-2.5 border-b border-gray-200 hover:bg-gray-50 flex items-center justify-between"
          >
            <div className="w-full pr-2 overflow-x-hidden">
              {/* TODO we need to figure out all possible type names to select appropriate icons every time */}
              <ScrollBar
                className="overflow-auto horizontal-only whitespace-nowrap"
                title={column.name}
              >
                <h5 className="font-mono text-xs text-gray-600">
                  {column.name}
                </h5>
              </ScrollBar>
            </div>
            <div className="uppercase text-xs text-gray-400 min-w-16 text-right">
              {column.type}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
