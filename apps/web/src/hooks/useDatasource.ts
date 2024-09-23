import { AthenaDataSourceInput } from '@/components/forms/athena'
import { BigQueryDataSourceInput } from '@/components/forms/bigquery'
import { MySQLDataSourceInput } from '@/components/forms/mysql'
import { OracleDataSourceInput } from '@/components/forms/oracle'
import { PostgreSQLDataSourceInput } from '@/components/forms/postgresql'
import { RedshiftDataSourceInput } from '@/components/forms/redshift'
import type { APIDataSource, DataSource } from '@briefer/database'
import { useCallback, useMemo } from 'react'
import { useDataSources } from './useDatasources'
import { TrinoDataSourceInput } from '@/components/forms/trino'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

type DataSourceInput =
  | PostgreSQLDataSourceInput
  | BigQueryDataSourceInput
  | RedshiftDataSourceInput
  | AthenaDataSourceInput
  | OracleDataSourceInput
  | MySQLDataSourceInput
  | TrinoDataSourceInput

type API = {
  update: (payload: DataSourceInput) => Promise<APIDataSource | null>
}
type UseDataSource = [{ data: APIDataSource | null; isLoading: boolean }, API]
export const useDataSource = (
  workspaceId: string,
  dataSourceId: string
): UseDataSource => {
  const [{ data, isLoading }] = useDataSources(workspaceId)
  const dataSource = useMemo(
    () => data?.find((d) => d.config.data.id === dataSourceId) ?? null,
    [data, dataSourceId]
  )

  const update = useCallback(
    async (payload: DataSourceInput) => {
      if (!dataSource) {
        return dataSource
      }

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources/${dataSourceId}`,
        {
          credentials: 'include',
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: dataSource.config.type,
            data: {
              ...payload,
              id: dataSourceId,
            },
          }),
        }
      )

      let error: string | null = null
      if (res.status === 400) {
        try {
          const body = await res.json()
          error = body.error
        } catch {}

        if (error) {
          throw new Error(error)
        }
      }
      if (res.status > 299) {
        throw new Error(`Unexpected status code ${res.status}`)
      }

      return res.json() as Promise<APIDataSource>
    },
    [dataSource, dataSourceId, workspaceId]
  )

  return useMemo(() => [{ data: dataSource, isLoading }, { update }], [])
}

export const useNewDataSource = (workspaceId: string) => {
  const [, { refreshAll }] = useDataSources(workspaceId)
  const create = useCallback(
    async (
      data: DataSourceInput,
      type:
        | 'bigquery'
        | 'psql'
        | 'redshift'
        | 'athena'
        | 'oracle'
        | 'mysql'
        | 'trino'
    ): Promise<DataSource> => {
      if (!workspaceId) {
        throw new Error('Missing workspaceId')
      }

      const res = await fetch(
        `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources`,
        {
          credentials: 'include',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type,
            data,
          }),
        }
      )

      let error: string | null = null
      if (res.status === 400) {
        try {
          const body = await res.json()
          error = body.error
        } catch {}

        if (error) {
          throw new Error(error)
        }
      }
      if (res.status > 299) {
        throw new Error(`Unexpected status ${res.status}`)
      }

      const result = await res.json()
      await refreshAll(workspaceId)
      return result
    },
    [workspaceId, refreshAll]
  )

  return create
}
