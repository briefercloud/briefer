import { AutoSizer, List, ListRowRenderer } from 'react-virtualized'
import { Map } from 'immutable'
import ExplorerTitle from './ExplorerTitle'
import { databaseImages } from '../DataSourcesList'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { ChevronLeftIcon } from '@heroicons/react/24/solid'
import type { DataSource, APIDataSource } from '@briefer/database'
import { SchemaInfo } from './SchemaInfo'
import { DataSourceSchema } from '@briefer/types'
import ScrollBar from '../ScrollBar'
import Spin from '../Spin'
import useSchemaList from '@/hooks/useSchemaList'
import SchemaItem from './SchemaItem'
import { useCallback } from 'react'

interface Props {
  schemas: Map<string, DataSourceSchema>
  dataSource: APIDataSource
  onBack: () => void
  onRetrySchema: (dataSource: DataSource) => void
  canRetrySchema: boolean
}
export default function SchemaList(props: Props) {
  const [
    { schemaList, search, searching },
    { setSearch, toggleSchema, toggleTable },
  ] = useSchemaList(props.schemas)

  const onChangeSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSearch(e.target.value)
    },
    [setSearch]
  )

  const rowHeight = useCallback(
    ({ index }: { index: number }): number =>
      schemaList.get(index)?._tag === 'column' ? 26 : 32,
    [schemaList]
  )
  const rowRenderer: ListRowRenderer = useCallback(
    ({ index, key, style }) => {
      const item = schemaList.get(index)
      if (!item) return null
      return (
        <div key={key} style={style}>
          <SchemaItem
            search={search}
            schemaItem={item}
            onToggleSchema={toggleSchema}
            onToggleTable={toggleTable}
          />
        </div>
      )
    },
    [schemaList, toggleSchema, toggleTable, search]
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
              value={search}
            />
            {searching && <Spin />}
          </div>
          <AutoSizer>
            {({ height, width }) => (
              <List
                width={width}
                height={height}
                rowHeight={rowHeight}
                rowCount={schemaList.size}
                rowRenderer={rowRenderer}
              />
            )}
          </AutoSizer>
        </div>
      </div>
    </div>
  )
}
