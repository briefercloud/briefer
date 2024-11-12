import Levenshtein from 'levenshtein'
import { Map } from 'immutable'
import ExplorerTitle from './ExplorerTitle'
import { databaseImages } from '../DataSourcesList'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import { ChevronLeftIcon } from '@heroicons/react/24/solid'
import { ShapesIcon } from 'lucide-react'
import type { DataSource, APIDataSource } from '@briefer/database'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SchemaInfo } from './SchemaInfo'
import TableList from './TableList'
import { DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import { useDebounce } from '@/hooks/useDebounce'

interface Props {
  schemas: Map<string, DataSourceSchema>
  dataSource: APIDataSource
  onBack: () => void
  onRetrySchema: (dataSource: DataSource) => void
  canRetrySchema: boolean
}
export default function SchemaList(props: Props) {
  const [search, setSearch] = useState('')
  const onChangeSearch = useDebounce(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    },
    500,
    []
  )

  const sortedSchemas = useMemo(
    () =>
      Array.from(props.schemas.entries())
        .filter(([schemaName, schema]) => {
          const columns = Object.entries(schema.tables).flatMap(
            ([tableName, table]) =>
              table.columns.flatMap(
                (column) => `${schemaName}.${tableName}.${column.name}`
              )
          )

          return columns.some(
            (column) =>
              search.trim() === '' ||
              column
                .trim()
                .toLowerCase()
                .includes(search.trim().toLowerCase()) ||
              new Levenshtein(
                column.trim().toLowerCase(),
                search.trim().toLowerCase()
              ).distance <=
                column.length / 2
          )
        })
        .sort(([a], [b]) => a.localeCompare(b)),
    [props.schemas, search]
  )

  return (
    <div className="flex flex-col h-full">
      <ExplorerTitle
        title="Schema explorer"
        description="Choose a schema to explore its tables."
        dataSource={props.dataSource}
        onRetrySchema={props.onRetrySchema}
        canRetrySchema={props.canRetrySchema}
      />

      <div className="pt-4 flex flex-col h-full overflow-hidden">
        <button
          className="relative flex px-4 py-2 text-xs font-medium border-y bg-gray-50 items-center justify-between font-mono hover:bg-gray-100 group w-full"
          onClick={props.onBack}
        >
          <div className="flex gap-x-1.5 items-center overflow-hidden">
            <ChevronLeftIcon className="h-3 w-3 text-gray-500 group-hover:text-gray-700" />
            <ScrollBar className="text-left overflow-auto horizontal-only whitespace-nowrap">
              <h4>{props.dataSource.config.data.name}</h4>
            </ScrollBar>
          </div>

          <div className="pl-1">
            <img
              src={databaseImages(props.dataSource.config.type)}
              alt=""
              className="h-4 w-4 group-hover:grayscale-[50%]"
            />
          </div>
        </button>

        <div className="flex-grow text-xs font-sans font-medium overflow-y-auto">
          <SchemaInfo
            dataSource={props.dataSource}
            onRetrySchema={props.onRetrySchema}
          />
          <div className="px-4 py-0 flex items-center border-b border-gray-200 group focus-within:border-blue-300">
            <MagnifyingGlassIcon className="h-3.5 w-3.5 text-gray-400 group-focus-within:text-blue-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-full h-8 border-0 placeholder-gray-400 text-xs text-gray-600 focus:outline-none focus:ring-0 pl-2"
              onChange={onChangeSearch}
            />
          </div>
          <ul className="h-full">
            {sortedSchemas.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-xs">
                No results found.
              </li>
            ) : (
              sortedSchemas.map(([schemaName, schema]) => (
                <SchemaItem
                  key={schemaName}
                  dataSource={props.dataSource}
                  schemaName={schemaName}
                  schema={schema}
                  search={search}
                />
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  )
}

interface SchemaItemProps {
  dataSource: APIDataSource
  schemaName: string
  schema: DataSourceSchema
  search: string
}
function SchemaItem(props: SchemaItemProps) {
  const [open, setOpen] = useState(false)
  const onToggleOpen = useCallback(() => {
    setOpen(!open)
  }, [open])
  useEffect(() => {
    if (props.search) {
      setOpen(true)
    }
  }, [props.search])

  return (
    <li key={props.schemaName}>
      <button
        className="px-3.5 py-2 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full font-normal"
        onClick={onToggleOpen}
      >
        <div className="flex gap-x-1.5 items-center overflow-hidden">
          <ShapesIcon className="h-3.5 w-3.5 text-gray-400" />
          <ScrollBar className="text-left overflow-auto horizontal-only whitespace-nowrap flex-auto">
            <h4>{props.schemaName}</h4>
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
        <TableList
          dataSource={props.dataSource}
          schemaName={props.schemaName}
          schema={props.schema}
          search={props.search}
        />
      </div>
    </li>
  )
}
