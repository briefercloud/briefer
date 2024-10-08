import { APIDataSources } from '@/hooks/useDatasources'
import ExplorerTitle from './ExplorerTitle'
import { databaseImages } from '../DataSourcesList'
import { ChevronRightIcon } from '@heroicons/react/24/outline'
import { ExclamationTriangleIcon } from '@heroicons/react/24/solid'
import { isDataSourceStructureLoading } from '@briefer/types'
import { useMemo } from 'react'

interface Props {
  dataSources: APIDataSources
  onSelectDataSource: (dataSourceId: string) => void
}
export default function DatabaseList(props: Props) {
  const sortedDataSources = useMemo(() => {
    return props.dataSources.sort((a, b) => {
      return a.config.data.name.localeCompare(b.config.data.name)
    })
  }, [props.dataSources])

  return (
    <div className="flex flex-col h-full">
      <ExplorerTitle
        title="Schema explorer"
        description="Choose a data source to explore its schema."
        dataSource={null}
        onRetrySchema={() => {}}
        canRetrySchema={false}
      />
      <div className="flex-grow text-sm text-gray-500 font-sans font-medium overflow-y-auto border-t border-gray-200 mt-4">
        <ul className="h-full">
          {sortedDataSources.map((dataSource) => {
            return (
              <li
                key={dataSource.config.data.id}
                className="px-4 xl:px-6 py-2 border-b border-gray-200 cursor-pointer hover:bg-gray-50 flex items-center justify-between"
                onClick={() =>
                  props.onSelectDataSource(dataSource.config.data.id)
                }
              >
                <div className="flex gap-x-2.5 items-center font-mono text-xs">
                  <img
                    src={databaseImages(dataSource.config.type)}
                    alt=""
                    className="h-4 w-4 text-red-600"
                  />
                  <h4>{dataSource.config.data.name}</h4>
                </div>
                <div className="flex gap-x-1 items-center">
                  {isDataSourceStructureLoading(dataSource.structure) ? (
                    <span className="font-normal text-xs text-gray-400 animate-pulse">
                      Refreshing...
                    </span>
                  ) : dataSource.structure.status === 'failed' ? (
                    <>
                      <ExclamationTriangleIcon className="h-3 w-3 text-yellow-400/70" />
                      <span className="font-normal text-xs text-gray-400">
                        Schema not loaded
                      </span>
                    </>
                  ) : null}
                  <ChevronRightIcon className="h-3 w-3 text-gray-500" />
                </div>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
