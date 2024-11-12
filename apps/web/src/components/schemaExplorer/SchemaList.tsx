import Levenshtein from 'levenshtein'
import { Map } from 'immutable'
import ExplorerTitle from './ExplorerTitle'
import { databaseImages } from '../DataSourcesList'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { ChevronLeftIcon } from '@heroicons/react/24/solid'
import { ShapesIcon } from 'lucide-react'
import type { DataSource, APIDataSource } from '@briefer/database'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { SchemaInfo } from './SchemaInfo'
import TableList from './TableList'
import { DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'

interface Props {
  schemas: Map<string, DataSourceSchema>
  dataSource: APIDataSource
  onBack: () => void
  onRetrySchema: (dataSource: DataSource) => void
  canRetrySchema: boolean
}
export default function SchemaList(props: Props) {
  const [search, setSearch] = useState('')
  const onChangeSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    },
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
          className="relative flex px-4 py-2 text-xs font-medium border-y bg-gray-50 text-gray-600 items-center justify-between font-mono hover:bg-gray-100 group w-full"
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

        <div className="flex-grow text-xs text-gray-500 font-sans font-medium overflow-y-auto">
          <SchemaInfo
            dataSource={props.dataSource}
            onRetrySchema={props.onRetrySchema}
          />
          <input
            type="text"
            className="w-full h-8 border-b border-gray-200"
            value={search}
            onChange={onChangeSearch}
          />
          <ul className="h-full">
            {sortedSchemas.map(([schemaName, schema]) => (
              <SchemaItem
                key={schemaName}
                dataSource={props.dataSource}
                schemaName={schemaName}
                schema={schema}
                search={search}
              />
            ))}
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
        className="px-4 py-2.5 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full"
        onClick={onToggleOpen}
      >
        <div className="flex gap-x-1.5 items-center font-mono overflow-hidden">
          {open ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-500" />
          )}
          <ScrollBar className="text-left overflow-auto horizontal-only whitespace-nowrap">
            <h4>{props.schemaName}</h4>
          </ScrollBar>
        </div>
        <div className="pl-1">
          <ShapesIcon className="text-gray-400 h-4 w-4" />
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
