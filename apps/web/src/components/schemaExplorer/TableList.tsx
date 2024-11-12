import { Map } from 'immutable'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Grid3x3Icon } from 'lucide-react'
import TableDetails from './TableDetails'
import type { APIDataSource } from '@briefer/database'
import { DataSourceColumn, DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import useDebouncedMemo from '@/hooks/useDebouncedMemo'
import { useCallback } from 'react'

interface Props {
  dataSource: APIDataSource
  schemaName: string
  schema: DataSourceSchema
  schemaState: Map<string, boolean>
  onToggleTableOpen: (schemaName: string, tableName: string) => void
  hiddenTables: Set<string>
  hiddenColumns: Set<string>
}
export default function TableList(props: Props) {
  const tables: { name: string; columns: DataSourceColumn[] }[] =
    useDebouncedMemo(
      () => {
        return Object.entries(props.schema.tables)
          .map(([tableName, table]) => {
            return {
              name: tableName,
              columns: table.columns,
            }
          })
          .sort((a, b) => a.name.localeCompare(b.name))
      },
      [props.schema],
      500
    )

  return (
    <ul>
      {tables.map(
        (table) =>
          !props.hiddenTables.has(`${props.schemaName}.${table.name}`) && (
            <TableItem
              key={table.name}
              schemaName={props.schemaName}
              tableName={table.name}
              columns={table.columns}
              open={props.schemaState.get(table.name) ?? false}
              onToggleOpen={props.onToggleTableOpen}
              hiddenColumns={props.hiddenColumns}
            />
          )
      )}
    </ul>
  )
}

interface TableItemProps {
  schemaName: string
  tableName: string
  columns: DataSourceColumn[]
  open: boolean
  onToggleOpen: (schemaName: string, tableName: string) => void
  hiddenColumns: Set<string>
}
function TableItem(props: TableItemProps) {
  const onToggleOpen = useCallback(() => {
    props.onToggleOpen(props.schemaName, props.tableName)
  }, [props.schemaName, props.tableName])

  return (
    <li key={props.tableName} className="">
      <button
        className="pl-6 pr-3.5 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full font-normal"
        onClick={onToggleOpen}
      >
        <div className="flex gap-x-1.5 items-center overflow-hidden">
          <Grid3x3Icon className="text-gray-400 min-h-3.5 min-w-3.5 h-3.5 w-3.5" />
          <ScrollBar
            className="overflow-auto horizontal-only whitespace-nowrap"
            title={props.tableName}
          >
            {props.tableName}
          </ScrollBar>
        </div>
        <div className="pl-1">
          {props.open ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-500" />
          )}
        </div>
      </button>
      {props.open && (
        <TableDetails
          schemaName={props.schemaName}
          tableName={props.tableName}
          columns={props.columns}
          hiddenColumns={props.hiddenColumns}
        />
      )}
    </li>
  )
}
