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
import { useCallback, useEffect, useState } from 'react'
import { SchemaInfo } from './SchemaInfo'
import TableList from './TableList'
import { DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import { useDebounce } from '@/hooks/useDebounce'
import useDebouncedMemo from '@/hooks/useDebouncedMemo'
import { splitEvery } from 'ramda'
import Spin from '../Spin'

interface Props {
  schemas: Map<string, DataSourceSchema>
  dataSource: APIDataSource
  onBack: () => void
  onRetrySchema: (dataSource: DataSource) => void
  canRetrySchema: boolean
}
export default function SchemaList(props: Props) {
  const [openState, setOpenState] = useState<
    Map<string, { open: boolean; tables: Map<string, boolean> }>
  >(Map())

  const [search, setSearch] = useState('')
  const onChangeSearch = useDebounce(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    },
    500,
    []
  )

  const [searching, setSearching] = useState(false)
  const [hiddenSchemas, setHiddenSchemas] = useState<Set<string>>(new Set())
  const [hiddenTables, setHiddenTables] = useState<Set<string>>(new Set())
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (search.trim() === '') {
      if (hiddenSchemas.size !== 0) {
        setHiddenSchemas(new Set())
      }

      if (hiddenTables.size !== 0) {
        setHiddenTables(new Set())
      }

      if (hiddenColumns.size !== 0) {
        setHiddenColumns(new Set())
      }

      setSearching(false)
      return
    }

    let active = true
    setSearching(true)
    const nextHiddenSchemas = new Set<string>()
    const nextHiddenTables = new Set<string>()
    const nextHiddenColumns = new Set<string>()

    const tasks: { schema: string; table: string; column: string }[] =
      Array.from(props.schemas.entries()).flatMap(([schemaName, schema]) =>
        Array.from(Object.entries(schema.tables)).flatMap(
          ([tableName, table]) => {
            nextHiddenSchemas.add(schemaName)
            nextHiddenTables.add(`${schemaName}.${tableName}`)

            return table.columns.map((column) => {
              nextHiddenColumns.add(`${schemaName}.${tableName}.${column.name}`)
              return {
                schema: schemaName,
                table: tableName,
                column: column.name,
              }
            })
          }
        )
      )

    Promise.resolve()
      .then(async () => {
        let startTime = Date.now()
        const FPS = 60
        let remaining = tasks.length
        for (const chunk of splitEvery(200, tasks)) {
          if (Date.now() - startTime > 1000 / FPS) {
            await new Promise((resolve) => requestAnimationFrame(resolve))
            startTime = Date.now()
          }

          if (!active) {
            return
          }

          for (const { schema, table, column } of chunk) {
            const fullColumnName = `${schema}.${table}.${column}`
            if (
              search.trim() === '' ||
              fullColumnName
                .trim()
                .toLowerCase()
                .includes(search.trim().toLowerCase()) ||
              new Levenshtein(
                fullColumnName.trim().toLowerCase(),
                search.trim().toLowerCase()
              ).distance <=
                fullColumnName.length / 2
            ) {
              nextHiddenColumns.delete(fullColumnName)
              nextHiddenTables.delete(`${schema}.${table}`)
              nextHiddenSchemas.delete(schema)
            }
          }

          setHiddenSchemas(nextHiddenSchemas)
          setHiddenTables(nextHiddenTables)
          setHiddenColumns(nextHiddenColumns)
          remaining -= chunk.length
        }
        setSearching(false)
      })
      .then(() => {
        if (!active) {
          return
        }

        setHiddenSchemas(nextHiddenSchemas)
        setHiddenTables(nextHiddenTables)
        setHiddenColumns(nextHiddenColumns)
        setSearching(false)
        let nextOpenState = Map<
          string,
          { open: boolean; tables: Map<string, boolean> }
        >()
        for (const { schema, table } of tasks) {
          const tables = nextOpenState.get(schema)?.tables ?? Map()
          nextOpenState = nextOpenState.set(schema, {
            open: !nextHiddenSchemas.has(schema),
            tables: tables.set(
              table,
              !nextHiddenTables.has(`${schema}.${table}`)
            ),
          })
        }
        setOpenState(nextOpenState)
      })

    return () => {
      active = false
    }
  }, [props.schemas, search])

  const sortedSchemas = useDebouncedMemo(
    () =>
      Array.from(props.schemas.entries()).sort(([a], [b]) =>
        a.localeCompare(b)
      ),
    [props.schemas],
    500
  )

  const onToggleSchemaOpen = useCallback((schemaName: string) => {
    setOpenState((state) => {
      const open = !(state.get(schemaName)?.open ?? false)
      return state.set(schemaName, {
        open,
        tables: state.get(schemaName)?.tables ?? Map(),
      })
    })
  }, [])

  const onToggleTableOpen = useCallback(
    (schemaName: string, tableName: string) => {
      setOpenState((state) => {
        const open = !(state.get(schemaName)?.tables.get(tableName) ?? false)
        return state.set(schemaName, {
          open: state.get(schemaName)?.open ?? false,
          tables:
            state.get(schemaName)?.tables.set(tableName, open) ??
            Map<string, boolean>().set(tableName, open),
        })
      })
    },
    []
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
            {searching && <Spin />}
          </div>
          <ul className="h-full">
            {sortedSchemas.length === 0 ? (
              <li className="px-4 py-4 text-gray-500 text-xs">
                No results found.
              </li>
            ) : (
              sortedSchemas.map(
                ([schemaName, schema]) =>
                  !hiddenSchemas.has(schemaName) && (
                    <SchemaItem
                      key={schemaName}
                      dataSource={props.dataSource}
                      schemaName={schemaName}
                      schema={schema}
                      search={search}
                      schemaState={openState.get(schemaName)?.tables ?? Map()}
                      open={openState.get(schemaName)?.open ?? false}
                      onToggleSchemaOpen={onToggleSchemaOpen}
                      onToggleTableOpen={onToggleTableOpen}
                      hiddenTables={hiddenTables}
                      hiddenColumns={hiddenColumns}
                    />
                  )
              )
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
  open: boolean
  onToggleSchemaOpen: (schemaName: string) => void
  schemaState: Map<string, boolean>
  onToggleTableOpen: (schemaName: string, tableName: string) => void
  hiddenTables: Set<string>
  hiddenColumns: Set<string>
}
function SchemaItem(props: SchemaItemProps) {
  const onToggleOpen = useCallback(() => {
    props.onToggleSchemaOpen(props.schemaName)
  }, [open])

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
          {props.open ? (
            <ChevronDownIcon className="h-3 w-3 text-gray-500" />
          ) : (
            <ChevronRightIcon className="h-3 w-3 text-gray-500" />
          )}
        </div>
      </button>
      {props.open && (
        <TableList
          dataSource={props.dataSource}
          schemaName={props.schemaName}
          schema={props.schema}
          schemaState={props.schemaState}
          onToggleTableOpen={props.onToggleTableOpen}
          hiddenTables={props.hiddenTables}
          hiddenColumns={props.hiddenColumns}
        />
      )}
    </li>
  )
}
