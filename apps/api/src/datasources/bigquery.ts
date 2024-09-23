import prisma, {
  BigQueryDataSource,
  DataSource,
  decrypt,
} from '@briefer/database'
import { BigQuery } from '@google-cloud/bigquery'
import { config } from '../config/index.js'
import {
  DataSourceSchema,
  DataSourceColumn,
  DataSourceStructure,
  DataSourceTable,
} from '@briefer/types'
import { DataSourceStatus } from './index.js'
import { z } from 'zod'
import { logger } from '../logger.js'

async function getBQClient(ds: BigQueryDataSource): Promise<BigQuery> {
  const bqDs = await prisma().bigQueryDataSource.findUniqueOrThrow({
    where: { id: ds.id },
  })

  const credentials = JSON.parse(
    decrypt(bqDs.serviceAccountKey, config().DATASOURCES_ENCRYPTION_KEY)
  )

  return new BigQuery({
    projectId: bqDs.projectId,
    credentials,
  })
}
export async function ping(ds: BigQueryDataSource): Promise<DataSource> {
  const bq = await getBQClient(ds)

  try {
    await bq.query('SELECT 1')
  } catch (e) {
    const parsedErr = z
      .object({
        name: z.string(),
        message: z.string(),
      })
      .safeParse(e)
    if (!parsedErr.success) {
      logger().error(
        {
          dataSourceId: ds.id,
          workspaceId: ds.workspaceId,
          error: e,
        },
        'Failed to parse error from BigQuery ping'
      )

      return updateConnStatus(ds, {
        connStatus: 'offline',
        connError: {
          name: 'UnknownError',
          message: 'Unknown error',
        },
      })
    }

    return updateConnStatus(ds, {
      connStatus: 'offline',
      connError: parsedErr.data,
    })
  }

  const now = new Date()
  return updateConnStatus(ds, { connStatus: 'online', lastConnection: now })
}

export async function getSchema(
  ds: BigQueryDataSource
): Promise<DataSourceStructure> {
  const bigQueryClient = await getBQClient(ds)
  const [datasets] = await bigQueryClient.getDatasets()
  const schemas: Record<string, DataSourceSchema> = {}

  for (const dataset of datasets) {
    const tablesResponse = await dataset.getTables()
    const tables: Record<string, DataSourceTable> = {}

    for (const table of tablesResponse[0]) {
      const [metadata] = await table.getMetadata()
      const columns: DataSourceColumn[] = metadata.schema.fields.map(
        (field: any) => ({
          name: field.name,
          type:
            field?.mode === 'REPEATED' ? `ARRAY<${field.type}>` : field.type,
        })
      )

      tables[table.id!] = { columns }
    }

    schemas[dataset.id!] = { tables }
  }

  return {
    dataSourceId: ds.id,
    schemas,
    // BigQuery does not have a concept of default schema
    defaultSchema: '',
  }
}

export async function updateConnStatus(
  ds: BigQueryDataSource,
  status: DataSourceStatus
): Promise<DataSource> {
  const newDs = await prisma().bigQueryDataSource.update({
    where: { id: ds.id },
    data: {
      connStatus: status.connStatus,
      lastConnection:
        status.connStatus === 'online' ? status.lastConnection : undefined,
      connError:
        status.connStatus === 'offline'
          ? JSON.stringify(status.connError)
          : undefined,
    },
  })

  return {
    type: 'bigquery',
    data: {
      ...ds,
      connStatus: newDs.connStatus,
      lastConnection: newDs.lastConnection?.toISOString() ?? null,
      connError: newDs.connError,
    },
  }
}
