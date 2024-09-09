import * as Y from 'yjs'
import { APIDataSources } from '@/hooks/useDatasources'
import WritebackTarget from './WritebackTarget'
import WritebackTableName from './WritebackTableName'
import { DataFrame } from '@briefer/types'
import WritebackDataframe from './WritebackDataframe'
import WritebackOnConflict from './WritebackOnConflict'
import WritebackOverwriteTable from './WritebackOverwriteTable'
import WritebackOnConflictColumns from './WritebackOnConflictColumns'
import clsx from 'clsx'
import { useState } from 'react'

interface Props {
  dataSources: APIDataSources
  dataSourceId: string
  onChangeDataSourceId: (value: string) => void

  tableName: Y.Text

  dataframes: DataFrame[]
  dataframe: DataFrame | null
  onChangeDataframe: (value: DataFrame) => void

  overwriteTable: boolean
  onChangeOverwriteTable: (value: boolean) => void

  onConflict: 'update' | 'ignore'
  onChangeOnConflict: (value: 'update' | 'ignore') => void

  onConflictColumns: string[]
  onChangeOnConflictColumns: (value: string[]) => void

  disabled: boolean
}
function WritebackControls(props: Props) {
  const datasource = props.dataSources.find(
    (ds) => ds.dataSource.data.id === props.dataSourceId
  )

  const [tab, setTab] = useState<'general' | 'overwrite'>('general')
  const onGeneralTab = () => setTab('general')
  const onOverwriteTab = () => setTab('overwrite')

  return (
    <>
      <div className="w-full border-b border-gray-200 pt-5 sticky top-0 bg-white z-10">
        <nav className="-mb-px flex" aria-label="Tabs">
          <button
            className={clsx(
              tab === 'general'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600',
              'whitespace-nowrap border-b-2 py-1 px-2 text-xs font-medium '
            )}
            aria-current={tab === 'general' ? 'page' : undefined}
            onClick={onGeneralTab}
          >
            General
          </button>
          <button
            className={clsx(
              tab === 'overwrite'
                ? 'border-primary-600 text-primary-700'
                : 'border-transparent text-gray-400 hover:border-gray-300 hover:text-gray-600',
              'whitespace-nowrap border-b-2 py-1 px-2 text-xs font-medium '
            )}
            aria-current={tab === 'overwrite' ? 'page' : undefined}
            onClick={onOverwriteTab}
          >
            Settings
          </button>
        </nav>
      </div>
      <div className="flex flex-col gap-y-3 p-4">
        {tab === 'general' && (
          <>
            <WritebackTarget
              value={props.dataSourceId}
              options={props.dataSources}
              onChange={props.onChangeDataSourceId}
              disabled={props.disabled}
            />
            <WritebackTableName
              name={props.tableName}
              disabled={props.disabled}
            />
            <WritebackDataframe
              value={props.dataframe}
              options={props.dataframes}
              onChange={props.onChangeDataframe}
              disabled={props.disabled}
            />
          </>
        )}
        {tab === 'overwrite' && (
          <>
            <WritebackOverwriteTable
              value={props.overwriteTable}
              onChange={props.onChangeOverwriteTable}
              disabled={props.disabled}
            />
            {!props.overwriteTable && (
              <>
                <WritebackOnConflict
                  value={props.onConflict}
                  onChange={props.onChangeOnConflict}
                  disabled={props.disabled}
                />
                {datasource && datasource.dataSource.type === 'bigquery' && (
                  <WritebackOnConflictColumns
                    value={props.onConflictColumns}
                    onChange={props.onChangeOnConflictColumns}
                    dataframe={props.dataframe}
                    disabled={props.disabled}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </>
  )
}

export default WritebackControls
