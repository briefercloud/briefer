import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { Grid3x3Icon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import TableDetails from './TableDetails'
import type { APIDataSource } from '@briefer/database'
import { DataSourceColumn, DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import Levenshtein from 'levenshtein'

interface Props {
  dataSource: APIDataSource
  schemaName: string
  schema: DataSourceSchema
  search: string
}
export default function TableList(props: Props) {
  const tables: { name: string; columns: DataSourceColumn[] }[] =
    useMemo(() => {
      return Object.entries(props.schema.tables)
        .map(([tableName, table]) => {
          return {
            name: tableName,
            columns: table.columns,
          }
        })
        .filter((table) => {
          const columns = table.columns.flatMap(
            (column) => `${props.schemaName}.${table.name}.${column.name}`
          )

          return columns.some(
            (column) =>
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
        })
        .sort((a, b) => a.name.localeCompare(b.name))
    }, [props.schema, props.search])

  return (
    <ul>
      {tables.map((table) => (
        <TableItem
          key={table.name}
          schemaName={props.schemaName}
          tableName={table.name}
          columns={table.columns}
          search={props.search}
        />
      ))}
    </ul>
  )
}

interface TableItemProps {
  schemaName: string
  tableName: string
  columns: DataSourceColumn[]
  search: string
}
function TableItem(props: TableItemProps) {
  const [open, setOpen] = useState(false)
  const onToggleOpen = useCallback(() => {
    setOpen((o) => !o)
  }, [])
  const onClose = useCallback(() => {
    setOpen(false)
  }, [])
  useEffect(() => {
    if (props.search) {
      setOpen(true)
    }
  }, [props.search])

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
          {open ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-500" />
          )}
        </div>
      </button>
      <div className={open ? 'block' : 'hidden'}>
        <TableDetails
          schemaName={props.schemaName}
          tableName={props.tableName}
          onCloseTableDetails={onClose}
          columns={props.columns}
          search={props.search}
        />
      </div>
    </li>
  )
}
