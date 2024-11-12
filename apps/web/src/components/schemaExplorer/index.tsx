import { Map } from 'immutable'
import { Transition } from '@headlessui/react'
import { useRef, useEffect, useState, useMemo, useCallback } from 'react'
import { ChevronDoubleRightIcon } from '@heroicons/react/24/outline'
import DatabaseList from './DatabaseList'
import { useDataSources } from '@/hooks/useDatasources'
import { useStringQuery } from '@/hooks/useQueryArgs'
import SchemaList from './SchemaList'
import { DataSource } from '@briefer/database'
import { DataSourceSchema } from '@briefer/types'

interface Props {
  workspaceId: string
  visible: boolean
  onHide: () => void
  dataSourceId: string | null
  canRetrySchema: boolean
}
export default function SchemaExplorer(props: Props) {
  const workspaceId = useStringQuery('workspaceId')

  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTop = ref.current.scrollHeight
    }
  }, [props.visible])

  const [{ datasources, schemas }, { refreshOne }] = useDataSources(workspaceId)
  const [state, setState] = useState<{
    initialDataSourceId: string | null
    dataSourceId: string | null
  }>({
    initialDataSourceId: props.dataSourceId,
    dataSourceId: props.dataSourceId,
  })
  useEffect(() => {
    if (!props.dataSourceId) {
      return
    }

    setState((s) =>
      s.dataSourceId !== props.dataSourceId
        ? {
            initialDataSourceId: props.dataSourceId,
            dataSourceId: props.dataSourceId,
            schema: null,
            table: null,
          }
        : s
    )
  }, [props.dataSourceId])

  const selectedDataSource = useMemo(() => {
    if (!state.dataSourceId) {
      return null
    }

    return (
      datasources.find((ds) => ds.config.data.id === state.dataSourceId) ?? null
    )
  }, [state.dataSourceId, datasources])

  const onSelectDataSource = useCallback(
    (dataSourceId: string) => {
      setState((s) =>
        s.dataSourceId !== dataSourceId
          ? {
              ...state,
              dataSourceId,
              schema: null,
              table: null,
            }
          : s
      )
    },
    [state]
  )

  const dataSourceSchemas: Map<string, DataSourceSchema> = useMemo(
    () =>
      state.dataSourceId ? schemas.get(state.dataSourceId) ?? Map() : Map(),
    [state.dataSourceId, schemas]
  )

  const onSchemaListBack = useCallback(() => {
    setState((s) => ({
      ...s,
      dataSourceId: null,
      schema: null,
      table: null,
    }))
  }, [])

  const onRetrySchema = useCallback(
    (dataSource: DataSource) => {
      refreshOne(
        dataSource.data.workspaceId,
        dataSource.data.id,
        dataSource.type
      )
    },
    [refreshOne]
  )

  return (
    <Transition
      show={props.visible}
      as="div"
      className="top-0 right-0 h-full absolute z-30"
      enter="transition ease-in-out duration-300 transform"
      enterFrom="translate-x-full"
      enterTo="translate-x-0"
      leave="transition ease-in-out duration-300 transform"
      leaveFrom="translate-x-0"
      leaveTo="translate-x-full"
    >
      <button
        className="absolute z-10 top-7 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-gray-100 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
        onClick={props.onHide}
      >
        <ChevronDoubleRightIcon className="w-3 h-3" />
      </button>
      <div
        className="w-[324px] border-l border-gray-200 h-full bg-white overflow-hidden text-gray-600"
        ref={ref}
      >
        {selectedDataSource ? (
          <SchemaList
            dataSource={selectedDataSource}
            schemas={dataSourceSchemas}
            onBack={onSchemaListBack}
            onRetrySchema={onRetrySchema}
            canRetrySchema={props.canRetrySchema}
          />
        ) : (
          <DatabaseList
            dataSources={datasources}
            onSelectDataSource={onSelectDataSource}
          />
        )}
      </div>
    </Transition>
  )
}
