import { PlusCircleIcon } from '@heroicons/react/20/solid'
import {
  CircleStackIcon,
  Cog8ToothIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import React, { useCallback, useEffect, useMemo, useState } from 'react'

import DataSourcesList, {
  dataSourcePrettyName,
} from '@/components/DataSourcesList'
import Layout from '@/components/Layout'
import { useDataSources } from '@/hooks/useDatasources'
import { useStringQuery } from '@/hooks/useQueryArgs'
import DataSourcesInfo from '@/components/DataSourcesInfo'
import { DataSource } from '@briefer/database'
import { Dialog, Transition } from '@headlessui/react'
import { DataSourceConnectionError, jsonString } from '@briefer/types'
import { GATEWAY_IP } from '@/utils/info'
import { useRouter } from 'next/router'
import SchemaExplorer from '@/components/schemaExplorer'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Data sources',
    icon: CircleStackIcon,
    href: `/workspaces/${workspaceId}/data-sources`,
    current: true,
  },
]

export default function DataSourcesPage() {
  const [showMoreInfo, setShowMoreInfo] = useState(false)
  const workspaceId = useStringQuery('workspaceId')

  const [{ data: dataSources }, { ping, remove }] = useDataSources(workspaceId)

  const openInfo = useCallback(() => setShowMoreInfo(true), [setShowMoreInfo])
  const closeInfo = useCallback(() => setShowMoreInfo(false), [setShowMoreInfo])

  const router = useRouter()
  const offline = useStringQuery('offline')
  const offlineDataSource = useMemo(
    () =>
      dataSources.find(
        (ds) =>
          ds.config.data.id === offline &&
          ds.config.data.connStatus === 'offline'
      )?.config ?? null,
    [offline, dataSources]
  )

  const onOpenOfflineDialog = useCallback(
    (id: string) => {
      router.replace({
        query: {
          ...router.query,
          offline: id,
        },
      })
    },
    [router]
  )

  const onCloseOfflineDialog = useCallback(() => {
    router.replace({
      query: {
        ...router.query,
        offline: undefined,
      },
    })
  }, [router])

  const onPing = useCallback(
    (id: string, type: string) => {
      const ds = dataSources.find(
        (ds) => ds.config.data.id === id
      )?.config
      if (!ds) {
        return
      }

      ping(workspaceId, id, type).then(({ connStatus }) => {
        if (connStatus === 'offline') {
          router.query.offline = id
        }
      })
    },
    [workspaceId, ping, dataSources, router]
  )

  const onRemove = useCallback(
    (id: string) => remove(workspaceId, id),
    [workspaceId, remove]
  )

  const [schemaExplorerDataSourceId, setSchemaExplorer] = useState<
    string | null
  >(null)
  const onSchemaExplorer = useCallback((id: string) => {
    setSchemaExplorer(id)
  }, [])
  const onHideSchemaExplorer = useCallback(() => {
    setSchemaExplorer(null)
  }, [])

  return (
    <Layout pagePath={pagePath(workspaceId ?? '')}>
      <DataSourcesInfo showInfo={showMoreInfo} closeInfo={closeInfo} />
      <OfflineDataSourceDialog
        dataSource={offlineDataSource}
        onClose={onCloseOfflineDialog}
      />

      <div className="w-full bg-white h-full overflow-scroll">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Data sources
            </h3>
            <div className="flex items-center gap-x-4">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-sm bg-white px-4 py-2 text-sm text-gray-800 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:w-auto"
                onClick={openInfo}
              >
                IPs and more info
              </button>
              <Link
                href={`/workspaces/${workspaceId}/data-sources/new`}
                className="flex items-center gap-x-2 rounded-sm shadow-sm bg-primary-200 px-3.5 py-2.5 text-sm font-semibold hover:bg-primary-300 border-stone-950"
              >
                <PlusCircleIcon className="h-4 w-4" /> Add data source
              </Link>
            </div>
          </div>

          <DataSourcesList
            workspaceId={workspaceId}
            dataSources={dataSources}
            onRemoveDataSource={onRemove}
            onPingDataSource={onPing}
            onOpenOfflineDialog={onOpenOfflineDialog}
            onSchemaExplorer={onSchemaExplorer}
          />
        </div>
      </div>
      <SchemaExplorer
        workspaceId={workspaceId}
        visible={schemaExplorerDataSourceId !== null}
        onHide={onHideSchemaExplorer}
        dataSourceId={schemaExplorerDataSourceId}
      />
    </Layout>
  )
}

interface OfflineDataSourceDialogProps {
  dataSource: DataSource | null
  onClose: () => void
}
function OfflineDataSourceDialog(props: OfflineDataSourceDialogProps) {
  const [dataSource, setDataSource] = useState<DataSource | null>(
    props.dataSource
  )
  useEffect(() => {
    if (props.dataSource !== null && props.dataSource !== dataSource) {
      setDataSource(props.dataSource)
    }
  }, [props.dataSource])

  const error = useMemo(() => {
    const parsed = jsonString
      .pipe(DataSourceConnectionError)
      .safeParse(dataSource?.data.connError)
    if (parsed.success) {
      return parsed.data
    }

    return null
  }, [dataSource?.data.connError])

  return (
    <Transition show={props.dataSource !== null}>
      <Dialog onClose={props.onClose} className="relative z-[100]">
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <ExclamationTriangleIcon
                      aria-hidden="true"
                      className="h-6 w-6 text-red-600"
                    />
                  </div>
                  <div className="w-full mt-3 text-center sm:ml-4 sm:mt-0 sm:text-left overflow-hidden">
                    <Dialog.Title
                      as="h3"
                      className="text-base font-semibold leading-6 text-gray-900"
                    >
                      {dataSourcePrettyName(dataSource?.type ?? 'psql')}{' '}
                      <span className="font-mono bg-gray-100 px-1 py-0.5">
                        {dataSource?.data.name ?? ''}
                      </span>{' '}
                      is unreachable
                    </Dialog.Title>
                    <div className="flex flex-col gap-y-2 text-gray-500 text-sm">
                      {error && (
                        <div>
                          <p className="py-1 pb-2">
                            {
                              'We tried to ping your data source but we got an error.'
                            }
                          </p>
                          <div className="px-4 py-4 bg-gray-100 w-full rounded-md overflow-scroll">
                            <pre className="whitespace-pre-wrap">
                              {error.name}
                            </pre>
                            <pre className="whitespace-pre-wrap">
                              {error.message}
                            </pre>
                          </div>
                        </div>
                      )}

                      <p>
                        Please double check whether the credentials are correct.
                        Also ensure your data source accepts connections from{' '}
                        <code className="bg-gray-100 px-1 py-0.5 rounded-md text-red-500">
                          {GATEWAY_IP()}
                        </code>
                        .
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                  <button
                    type="button"
                    onClick={props.onClose}
                    className="mt-3 inline-flex justify-center rounded-sm shadow-sm bg-primary-200 px-3.5 py-2.5 text-sm font-semibold hover:bg-primary-300"
                  >
                    Ok
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
