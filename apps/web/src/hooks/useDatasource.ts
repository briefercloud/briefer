import { AthenaDataSourceInput } from '@/components/forms/athena'
import { BigQueryDataSourceInput } from '@/components/forms/bigquery'
import { MySQLDataSourceInput } from '@/components/forms/mysql'
import { OracleDataSourceInput } from '@/components/forms/oracle'
import { PostgreSQLDataSourceInput } from '@/components/forms/postgresql'
import { RedshiftDataSourceInput } from '@/components/forms/redshift'
import fetcher from '@/utils/fetcher'
import type { DataSource } from '@briefer/database'
import { DataSourceStructure } from '@briefer/types'
import { useCallback, useMemo } from 'react'
import useSWR, { SWRResponse } from 'swr'
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

type State = {
  dataSource: DataSource
  structure: DataSourceStructure
}
type API = {
  update: (payload: DataSourceInput) => Promise<State | undefined>
}
type UseDataSource = [SWRResponse<State>, API]
export const useDataSource = (
  workspaceId: string,
  dataSourceId: string
): UseDataSource => {
  const swrRes = useSWR<State>(
    `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${workspaceId}/data-sources/${dataSourceId}`,
    fetcher
  )

  const update = useCallback(
    async (payload: DataSourceInput) => {
      return await swrRes.mutate(async (data) => {
        if (!data) {
          return data
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
              type: data.dataSource.type,
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

        return {
          dataSource: (await res.json()) as DataSource,
          structure: data.structure,
        }
      })
    },
    [swrRes]
  )
  return useMemo(() => [swrRes, { update }], [swrRes, update])
}

export const useNewDataSource = (workspaceId: string) => {
  const [, , { refresh }] = useDataSources(workspaceId)
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
      await refresh()
      return result
    },
    [workspaceId, refresh]
  )

  return create
}
