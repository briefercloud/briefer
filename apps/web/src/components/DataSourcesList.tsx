import { APIDataSources } from '@/hooks/useDatasources'
import type { DataSource, DataSourceType } from '@briefer/database'
import { Menu, Transition } from '@headlessui/react'
import { EllipsisVerticalIcon } from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { formatDistanceToNow, differenceInSeconds } from 'date-fns'
import Link from 'next/link'
import { Fragment, useCallback, useMemo } from 'react'

export const dataSourcePrettyName = (t: DataSourceType): string => {
  switch (t) {
    case 'psql':
      return 'PostgreSQL'
    case 'mysql':
      return 'MySQL'
    case 'sqlserver':
      return 'SQLServer'
    case 'bigquery':
      return 'BigQuery'
    case 'athena':
      return 'Athena'
    case 'redshift':
      return 'Redshift'
    case 'oracle':
      return 'Oracle'
    case 'trino':
      return 'Trino'
    case 'snowflake':
      return 'Snowflake'
  }
}

export const databaseImages = (t: DataSourceType): string => {
  switch (t) {
    case 'psql':
      return '/icons/postgres.png'
    case 'mysql':
      return '/icons/mysql.png'
    case 'sqlserver':
      return '/icons/sqlserver.png'
    case 'bigquery':
      return '/icons/bigquery.png'
    case 'athena':
      return '/icons/athena.png'
    case 'redshift':
      return '/icons/redshift.png'
    case 'oracle':
      return '/icons/oracle.png'
    case 'trino':
      return '/icons/trino.png'
    case 'snowflake':
      return '/icons/snowflake.png'
  }
}

const databaseUrl = (ds: DataSource): string => {
  if (ds.data.isDemo) {
    switch (ds.type) {
      case 'psql':
        return 'postgresql://demodb'
      case 'redshift':
        return 'redshift://demodb'
      case 'bigquery':
        return 'bigquery://demodb'
      case 'athena':
        return 'athena://demodb'
      case 'oracle':
        return 'oracle://demodb'
      case 'mysql':
        return 'mysql://demodb'
      case 'sqlserver':
        return 'sqlserver://demodb'
      case 'trino':
        return 'trino://demodb'
      case 'snowflake':
        return 'snowflake://demodb'
    }
  } else {
    switch (ds.type) {
      case 'psql':
        return `postgresql://${ds.data.host}:${ds.data.port}/${ds.data.database}`
      case 'redshift':
        return `redshift://${ds.data.host}:${ds.data.port}/${ds.data.database}`
      case 'bigquery':
        return `bigquery://${ds.data.projectId}`
      case 'athena':
        return `athena://${ds.data.region}.amazonaws.com:443?s3_staging_dir=${ds.data.s3OutputPath}&aws_access_key_id=********&aws_secret_access_key=********`
      case 'oracle':
        return `oracle://${ds.data.host}:${ds.data.port}/${ds.data.database}`
      case 'mysql':
        return `mysql://${ds.data.host}:${ds.data.port}/${ds.data.database}`
      case 'sqlserver':
        return `sqlserver://${ds.data.host}:${ds.data.port};databaseName=${ds.data.database};user=${ds.data.username};`
      case 'trino':
        return (
          `trino://${ds.data.host}:${ds.data.port}` +
          (ds.data.catalog ? `/${ds.data.catalog}` : '')
        )
      case 'snowflake':
        return `snowflake://${ds.data.account}/${ds.data.database}?warehouse=${ds.data.warehouse}`
    }
  }
}

interface LastConnectionProps {
  dataSource: DataSource
  onOpenOfflineDialog: (id: string) => void
}

function LastConnection(props: LastConnectionProps) {
  const prettyConnStatus = useMemo(() => {
    if (props.dataSource.data.isDemo) {
      return 'Online'
    }

    switch (props.dataSource.data.connStatus) {
      case 'online':
        return 'Online'
      case 'offline':
        return 'Offline'
      case 'checking':
        return 'Checking'
      default:
        return 'Unknown'
    }
  }, [props.dataSource.data.connStatus])

  const lastConnText = props.dataSource.data.isDemo
    ? 'just now'
    : props.dataSource.data.lastConnection === null
    ? 'never'
    : differenceInSeconds(
        new Date(),
        new Date(props.dataSource.data.lastConnection)
      ) < 30
    ? 'just now'
    : formatDistanceToNow(new Date(props.dataSource.data.lastConnection), {
        addSuffix: true,
      })

  const [statusBallColor, statusBallRippleColor] = useMemo(() => {
    if (props.dataSource.data.isDemo) {
      return ['bg-emerald-500', 'bg-emerald-500/20']
    }

    switch (props.dataSource.data.connStatus) {
      case 'online':
        return ['bg-emerald-500', 'bg-emerald-500/20']
      case 'offline':
        return ['bg-red-500', 'bg-red-500/20']
      case 'checking':
        return ['bg-yellow-500', 'bg-yellow-500/20']
      default:
        return ['bg-gray-300', 'bg-gray-300/20']
    }
  }, [props.dataSource.data.connStatus])

  const onStatusClick = useCallback(() => {
    if (props.dataSource.data.connStatus === 'offline') {
      props.onOpenOfflineDialog(props.dataSource.data.id)
    }
  }, [props.dataSource.data.connStatus, props.onOpenOfflineDialog])

  return (
    <div className="mt-1 flex items-center gap-x-1.5">
      <div
        className={clsx('flex-none rounded-full p-1', statusBallRippleColor)}
      >
        <div
          className={clsx(
            'h-1.5 w-1.5 rounded-full bg-emerald-500',
            statusBallColor
          )}
        />
      </div>
      <p className="text-xs leading-5 text-gray-500 flex space-x-2 items-center">
        <button
          className={
            props.dataSource.data.connStatus === 'offline'
              ? 'hover:underline cursor-pointer'
              : 'cursor-default'
          }
          onClick={onStatusClick}
        >
          {prettyConnStatus}
        </button>
        {props.dataSource.data.lastConnection && (
          <>
            <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 fill-current">
              <circle cx={1} cy={1} r={1} />
            </svg>
            <span>Last pinged {lastConnText}</span>
          </>
        )}
      </p>
    </div>
  )
}

interface Props {
  workspaceId: string
  dataSources: APIDataSources
  onRemoveDataSource: (id: string) => void
  onPingDataSource: (id: string, type: string) => void
  onOpenOfflineDialog: (id: string) => void
  onSchemaExplorer: (id: string) => void
}

export default function DataSourcesList(props: Props) {
  const orderedAPIDataSources = useMemo(() => {
    return props.dataSources.sort((a, b) => {
      if (a.config.data.name < b.config.data.name) return -1
      if (a.config.data.name > b.config.data.name) return 1
      return 0
    })
  }, [props.dataSources])

  if (props.dataSources.size === 0) {
    return <EmptyAPIDataSources workspaceId={props.workspaceId} />
  }

  return (
    <ul role="list" className="divide-y divide-gray-200 pt-1">
      {orderedAPIDataSources.map(({ config: dataSource }) => (
        <li
          key={dataSource.data.id}
          className="flex justify-between gap-x-6 py-5"
        >
          <div className="flex min-w-0 gap-x-4">
            <img
              className="h-12 w-12 flex-none"
              src={databaseImages(dataSource.type)}
              alt=""
            />
            <div className="min-w-0 flex-auto">
              <p className="text-sm font-semibold leading-6 text-gray-900">
                {dataSource.data.name}
              </p>
              <p className="mt-1 flex text-xs leading-5 text-gray-500">
                <span className="truncate">{databaseUrl(dataSource)}</span>
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-x-6">
            <div className="hidden sm:flex sm:flex-col sm:items-end">
              <p className="text-sm leading-6 text-gray-900">
                {dataSourcePrettyName(dataSource.type)}
              </p>
              <LastConnection
                dataSource={dataSource}
                onOpenOfflineDialog={props.onOpenOfflineDialog}
              />
            </div>
            <Menu as="div" className="relative flex-none">
              <Menu.Button className="-m-2.5 block p-2.5 text-gray-500 hover:text-gray-900">
                <span className="sr-only">Open options</span>
                <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
              </Menu.Button>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items className="absolute right-0 z-10 mt-2 w-32 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
                  {!dataSource.data.isDemo && (
                    <Menu.Item>
                      {({ active }) => (
                        <Link
                          href={`/workspaces/${props.workspaceId}/data-sources/edit/${dataSource.data.id}`}
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'block px-3 py-1 text-sm leading-6 text-gray-900'
                          )}
                        >
                          Edit
                          <span className="sr-only">
                            , {dataSource.data.name}
                          </span>
                        </Link>
                      )}
                    </Menu.Item>
                  )}
                  {!dataSource.data.isDemo && (
                    <Menu.Item>
                      {({ active }) => (
                        <button
                          onClick={() =>
                            props.onPingDataSource(
                              dataSource.data.id,
                              dataSource.type
                            )
                          }
                          className={clsx(
                            active ? 'bg-gray-50' : '',
                            'block px-3 py-1 text-sm leading-6 text-gray-900 w-full text-left'
                          )}
                        >
                          Ping
                          <span className="sr-only">
                            , {dataSource.data.name}
                          </span>
                        </button>
                      )}
                    </Menu.Item>
                  )}
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() => {
                          props.onSchemaExplorer(dataSource.data.id)
                        }}
                        className={clsx(
                          active ? 'bg-gray-50' : '',
                          'block px-3 py-1 text-sm leading-6 text-gray-900 w-full text-left'
                        )}
                      >
                        Explore schema
                        <span className="sr-only">
                          , {dataSource.data.name}
                        </span>
                      </button>
                    )}
                  </Menu.Item>
                  <Menu.Item>
                    {({ active }) => (
                      <button
                        onClick={() =>
                          props.onRemoveDataSource(dataSource.data.id)
                        }
                        className={clsx(
                          active ? 'bg-gray-50' : '',
                          'text-left w-full px-3 py-1 text-sm leading-6 text-red-600 block'
                        )}
                      >
                        Remove
                        <span className="sr-only">
                          , {dataSource.data.name}
                        </span>
                      </button>
                    )}
                  </Menu.Item>
                </Menu.Items>
              </Transition>
            </Menu>
          </div>
        </li>
      ))}
    </ul>
  )
}

interface EmptyAPIDataSourcesProps {
  workspaceId: string
}

function EmptyAPIDataSources(props: EmptyAPIDataSourcesProps) {
  return (
    <div className="py-6">
      <Link href={`/workspaces/${props.workspaceId}/data-sources/new`}>
        <div className="text-center py-12 bg-ceramic-50/60 hover:bg-ceramic-50 rounded-xl">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 14v20c0 4.418 7.163 8 16 8 1.381 0 2.721-.087 4-.252M8 14c0 4.418 7.163 8 16 8s16-3.582 16-8M8 14c0-4.418 7.163-8 16-8s16 3.582 16 8m0 0v14m0-4c0 4.418-7.163 8-16 8S8 28.418 8 24m32 10v6m0 0v6m0-6h6m-6 0h-6"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">
            No data sources
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Add a data source to start running analyses.
          </p>
        </div>
      </Link>
    </div>
  )
}
