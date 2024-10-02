import React, { useCallback, useState } from 'react'
import { PlusCircleIcon } from '@heroicons/react/20/solid'
import Layout from '@/components/Layout'
import { CircleStackIcon, Cog8ToothIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useStringQuery } from '@/hooks/useQueryArgs'
import Files from '@/components/Files'

const pagePath = (workspaceId: string) => [
  { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
  {
    name: 'Data sources',
    icon: CircleStackIcon,
    href: `/workspaces/${workspaceId}/data-sources`,
    current: true,
  },
  {
    name: 'Select data source type',
    icon: PlusCircleIcon,
    href: `/workspaces/${workspaceId}/data-sources/new`,
    current: true,
  },
]

type DataSourceBlockProps = {
  name: string
  icon: string
  href: string
}

const DataSourceBlock = ({ name, icon, href }: DataSourceBlockProps) => {
  return (
    <Link
      href={href}
      className="py-5 px-6 w-36 h-36 border border-gray-200 rounded-md flex flex-col items-center justify-between bg-gray-50 hover:bg-ceramic-50 hover:border-gray-300"
    >
      <img src={icon} alt="" className="h-16 w-16" />
      <span className="text-md">{name}</span>
    </Link>
  )
}

export default function DataSourcesPage() {
  const workspaceId = useStringQuery('workspaceId') ?? ''

  const [filesOpen, setFilesOpen] = useState(false)
  const onToggleFiles = useCallback(() => {
    setFilesOpen((prev) => !prev)
  }, [])

  return (
    <Layout pagePath={pagePath(workspaceId)}>
      <div className="bg-white w-full h-full">
        <div className="px-4 sm:p-6 lg:p-8">
          <div className="border-b border-gray-200 pb-4 sm:flex sm:items-center sm:justify-between">
            <h3 className="text-lg font-medium leading-6 text-gray-900">
              Select data source type
            </h3>
          </div>
          <div className="w-full pt-6 flex gap-x-4 gap-y-4 flex-wrap">
            <DataSourceBlock
              icon="/icons/athena.png"
              name="Athena"
              href={`/workspaces/${workspaceId}/data-sources/new/athena`}
            />
            <DataSourceBlock
              icon="/icons/bigquery.png"
              name="BigQuery"
              href={`/workspaces/${workspaceId}/data-sources/new/bigquery`}
            />
            <DataSourceBlock
              icon="/icons/mysql.png"
              name="MySql"
              href={`/workspaces/${workspaceId}/data-sources/new/mysql`}
            />
            <DataSourceBlock
              icon="/icons/sqlserver.png"
              name="SQL Server"
              href={`/workspaces/${workspaceId}/data-sources/new/sqlserver`}
            />
            <DataSourceBlock
              icon="/icons/oracle.png"
              name="Oracle"
              href={`/workspaces/${workspaceId}/data-sources/new/oracle`}
            />
            <DataSourceBlock
              icon="/icons/postgres.png"
              name="PostgreSQL"
              href={`/workspaces/${workspaceId}/data-sources/new/postgresql`}
            />
            <DataSourceBlock
              icon="/icons/redshift.png"
              name="Redshift"
              href={`/workspaces/${workspaceId}/data-sources/new/redshift`}
            />
            <DataSourceBlock
              icon="/icons/trino.png"
              name="Trino"
              href={`/workspaces/${workspaceId}/data-sources/new/trino`}
            />

            <button
              onClick={onToggleFiles}
              className="py-5 px-6 w-36 h-36 border border-gray-200 rounded-md flex flex-col items-center justify-between bg-gray-50 hover:bg-ceramic-50 hover:border-gray-300"
            >
              <img src="/icons/csv.png" alt="" className="h-16 w-16" />
              <span className="text-md">Files</span>
            </button>
          </div>
        </div>
      </div>
      <Files
        workspaceId={workspaceId}
        visible={filesOpen}
        onHide={() => setFilesOpen(false)}
      />
    </Layout>
  )
}
