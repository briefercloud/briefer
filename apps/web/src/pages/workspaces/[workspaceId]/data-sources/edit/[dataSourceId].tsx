import {
  CircleStackIcon,
  Cog8ToothIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { useRouter } from 'next/router'
import { useCallback } from 'react'

import Layout from '@/components/Layout'
import BigQueryForm, {
  BigQueryDataSourceInput,
} from '@/components/forms/bigquery'
import PostgreSQLForm, {
  PostgreSQLDataSourceInput,
} from '@/components/forms/postgresql'
import RedshiftForm, {
  RedshiftDataSourceInput,
} from '@/components/forms/redshift'
import { useDataSource } from '@/hooks/useDatasource'
import { useStringQuery } from '@/hooks/useQueryArgs'
import AthenaForm, { AthenaDataSourceInput } from '@/components/forms/athena'
import OracleForm, { OracleDataSourceInput } from '@/components/forms/oracle'
import MySQLForm, { MySQLDataSourceInput } from '@/components/forms/mysql'
import TrinoForm, { TrinoDataSourceInput } from '@/components/forms/trino'

export default function EditDataSourcePostgresSQLPage() {
  const router = useRouter()
  const workspaceId = useStringQuery('workspaceId')
  const dataSourceId = useStringQuery('dataSourceId')

  const [{ data }, { update }] = useDataSource(workspaceId, dataSourceId)

  const onSubmit = useCallback(
    async (
      input:
        | PostgreSQLDataSourceInput
        | BigQueryDataSourceInput
        | RedshiftDataSourceInput
        | AthenaDataSourceInput
        | OracleDataSourceInput
        | MySQLDataSourceInput
        | TrinoDataSourceInput
    ) => {
      if (!data) {
        return
      }

      try {
        const data = await update(input)
        if (data && data.config.data.connStatus === 'offline') {
          router.push(
            `/workspaces/${workspaceId}/data-sources?offline=${data.config.data.id}`
          )
        } else {
          router.push(`/workspaces/${workspaceId}/data-sources`)
        }
      } catch (err: any) {
        // TODO: improve this error handling
        alert(err.message || 'Something went wrong')
      }
    },
    [workspaceId, dataSourceId, data, router]
  )

  const pagePath = [
    { name: 'Configurations', icon: Cog8ToothIcon, href: '#', current: false },
    {
      name: 'Data sources',
      icon: CircleStackIcon,
      href: `/workspaces/${workspaceId}/data-sources`,
      current: false,
    },
    {
      name: `Edit ${
        data ? (data.config.type === 'psql' ? 'PostgreSQL' : 'BigQuery') : ''
      } data source`,
      icon: PlusCircleIcon,
      href: '#',
      current: true,
    },
  ]

  console.log(data)

  return (
    <Layout pagePath={pagePath} hideOnboarding>
      <div className="w-full overflow-scroll">
        {data && data.config.type === 'psql' ? (
          <PostgreSQLForm
            workspaceId={workspaceId}
            onSubmit={onSubmit}
            postgreSQLDataSource={data.config.data}
          />
        ) : data && data.config.type === 'redshift' ? (
          <RedshiftForm
            workspaceId={workspaceId}
            onSubmit={onSubmit}
            redshiftDataSource={data.config.data}
          />
        ) : data && data.config.type === 'athena' ? (
          <AthenaForm
            workspaceId={workspaceId}
            athenaDataSource={data.config.data}
            onSubmit={onSubmit}
          />
        ) : data && data.config.type === 'oracle' ? (
          <OracleForm
            workspaceId={workspaceId}
            oracleDataSource={data.config.data}
            onSubmit={onSubmit}
          />
        ) : data && data.config.type === 'bigquery' ? (
          <BigQueryForm
            workspaceId={workspaceId}
            bigQueryDataSource={data.config.data}
            onSubmit={onSubmit}
          />
        ) : data && data.config.type === 'mysql' ? (
          <MySQLForm
            workspaceId={workspaceId}
            onSubmit={onSubmit}
            mySQLDataSource={data.config.data}
          />
        ) : data && data.config.type === 'trino' ? (
          <TrinoForm
            workspaceId={workspaceId}
            onSubmit={onSubmit}
            trinoDataSource={data.config.data}
          />
        ) : null}
      </div>
    </Layout>
  )
}
