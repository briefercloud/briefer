import { Router } from 'express'
import {
  deleteBigQueryDataSource,
  getBigQueryDataSource,
  updateBigQueryDataSource,
  deletePSQLDataSource,
  getPSQLDataSource,
  updatePSQLDataSource,
  deleteRedshiftDataSource,
  getRedshiftDataSource,
  updateRedshiftDataSource,
  getDatasource,
  recoverFromNotFound,
  updateAthenaDataSource,
  getAthenaDataSource,
  deleteAthenaDataSource,
  getOracleDataSource,
  updateOracleDataSource,
  deleteOracleDataSource,
  getMySQLDataSource,
  updateMySQLDataSource,
  deleteMySQLDataSource,
  getTrinoDataSource,
  updateTrinoDataSource,
  deleteTrinoDataSource,
} from '@briefer/database'
import { z } from 'zod'
import { getParam } from '../../../../utils/express.js'
import config from '../../../../config/index.js'
import * as psql from '../../../../datasources/psql.js'
import * as bq from '../../../../datasources/bigquery.js'
import * as redshift from '../../../../datasources/redshift.js'
import * as athena from '../../../../datasources/athena.js'
import * as oracle from '../../../../datasources/oracle.js'
import * as mysql from '../../../../datasources/mysql.js'
import * as trino from '../../../../datasources/trino.js'
import { ping } from '../../../../datasources/index.js'
import { getStructure } from '../../../../datasources/structure.js'

const dataSourceRouter = Router({ mergeParams: true })

const dataSourceSchema = z.union([
  z.object({
    type: z.union([z.literal('psql'), z.literal('redshift')]),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string().min(1),
      username: z.string().min(1),
      password: z.string(),
      notes: z.string(),
      readOnly: z.boolean(),
      cert: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('mysql'),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string().min(1),
      username: z.string().min(1),
      password: z.string(),
      notes: z.string(),
      cert: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('bigquery'),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      projectId: z.string(),
      serviceAccountKey: z.string(),
      notes: z.string(),
    }),
  }),
  z.object({
    type: z.literal('athena'),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      region: z.string().min(1),
      accessKeyId: z.string(),
      secretAccessKeyId: z.string(),
      s3OutputPath: z.string(),
      notes: z.string(),
    }),
  }),
  z.object({
    type: z.literal('oracle'),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string(),
      serviceName: z.string(),
      sid: z.string(),
      username: z.string().min(1),
      password: z.string(),
      notes: z.string(),
    }),
  }),
  z.object({
    type: z.literal('trino'),
    data: z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      catalog: z.string(),
      username: z.string().min(1),
      password: z.string(),
      notes: z.string(),
      readOnly: z.boolean(),
    }),
  }),
])

dataSourceRouter.get('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const id = getParam(req, 'dataSourceId')
  try {
    const dataSource = (
      await Promise.all([
        getDatasource(workspaceId, id, 'psql'),
        getDatasource(workspaceId, id, 'bigquery'),
        getDatasource(workspaceId, id, 'redshift'),
        getDatasource(workspaceId, id, 'athena'),
        getDatasource(workspaceId, id, 'oracle'),
        getDatasource(workspaceId, id, 'mysql'),
        getDatasource(workspaceId, id, 'trino'),
      ])
    ).find((e) => e !== null)

    if (!dataSource) {
      res.status(404).end()
      return
    }

    const structure = await getStructure(dataSource)

    res.json({
      dataSource,
      structure,
    })
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        id,
        err,
      },
      'Failed to get data source'
    )
    res.status(500).end()
  }
})

dataSourceRouter.put('/', async (req, res) => {
  const result = dataSourceSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')
  const dataSourceId = getParam(req, 'dataSourceId')
  const data = result.data
  const existingDb = (
    await Promise.all([
      getPSQLDataSource(workspaceId, dataSourceId),
      getBigQueryDataSource(workspaceId, dataSourceId),
      getRedshiftDataSource(workspaceId, dataSourceId),
      getAthenaDataSource(workspaceId, dataSourceId),
      getOracleDataSource(workspaceId, dataSourceId),
      getMySQLDataSource(workspaceId, dataSourceId),
      getTrinoDataSource(workspaceId, dataSourceId),
    ])
  ).find((e) => e !== null)
  if (!existingDb) {
    res.status(404).end()
    return
  }

  if (existingDb.isDemo) {
    res.status(403).end()
    return
  }

  switch (data.type) {
    case 'psql': {
      const psqlDs = await updatePSQLDataSource(
        {
          ...data.data,
          id: dataSourceId,
          password: data.data.password === '' ? undefined : data.data.password,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await psql.ping(psqlDs)
      break
    }
    case 'mysql': {
      const mysqlDs = await updateMySQLDataSource(
        {
          ...data.data,
          id: dataSourceId,
          password: data.data.password === '' ? undefined : data.data.password,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await mysql.ping(mysqlDs)
      break
    }
    case 'redshift': {
      const redshiftDs = await updateRedshiftDataSource(
        {
          ...data.data,
          id: dataSourceId,
          password: data.data.password === '' ? undefined : data.data.password,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await redshift.ping(redshiftDs)
      break
    }
    case 'bigquery': {
      const bqDs = await updateBigQueryDataSource(
        {
          ...data.data,
          id: dataSourceId,
          projectId:
            data.data.projectId === '' ? undefined : data.data.projectId,
          serviceAccountKey:
            data.data.serviceAccountKey === ''
              ? undefined
              : data.data.serviceAccountKey,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await bq.ping(bqDs)
      break
    }
    case 'athena': {
      const athenaDs = await updateAthenaDataSource(
        {
          ...data.data,
          id: dataSourceId,
          accessKeyId:
            data.data.accessKeyId === '' ? undefined : data.data.accessKeyId,
          secretAccessKeyId:
            data.data.secretAccessKeyId === ''
              ? undefined
              : data.data.secretAccessKeyId,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await athena.ping(athenaDs)
      break
    }
    case 'oracle': {
      if (!data.data.sid && !data.data.serviceName && !data.data.database) {
        res.status(400).json({
          error: 'Either service name, database or SID must be provided',
        })
        return
      }

      const oracleDs = await updateOracleDataSource(
        {
          ...data.data,
          id: dataSourceId,
          password: data.data.password === '' ? undefined : data.data.password,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await oracle.ping(oracleDs)
      break
    }
    case 'trino': {
      const trinoDs = await updateTrinoDataSource(
        {
          ...data.data,
          id: dataSourceId,
          password: data.data.password === '' ? undefined : data.data.password,
        },
        config().DATASOURCES_ENCRYPTION_KEY
      )

      await trino.ping(trinoDs)
      break
    }
  }

  const ds = await getDatasource(workspaceId, dataSourceId, data.type)
  if (!ds) {
    req.log.error(
      {
        workspaceId,
        dataSourceId,
        type: data.type,
      },
      'Failed to find datasource after update'
    )
    res.status(500).end()
    return
  }

  // fetch structure in the background
  await Promise.race([
    getStructure(ds, true).then(() => {}),
    new Promise<void>((resolve) => setTimeout(() => resolve(), 1000)),
  ])

  res.json(ds)
})

dataSourceRouter.delete('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const targetId = getParam(req, 'dataSourceId')

  const targetPsqlDb = await recoverFromNotFound(
    deletePSQLDataSource(workspaceId, targetId)
  )
  if (targetPsqlDb) {
    res.status(200).json({
      type: 'psql',
      data: targetPsqlDb,
    })
    return
  }

  const targetRedshiftDb = await recoverFromNotFound(
    deleteRedshiftDataSource(targetId)
  )
  if (targetRedshiftDb) {
    res.status(200).json({
      type: 'psql',
      data: targetRedshiftDb,
    })
    return
  }

  const targetBigQueryDb = await recoverFromNotFound(
    deleteBigQueryDataSource(targetId)
  )
  if (targetBigQueryDb) {
    res.status(200).json({
      type: 'bigquery',
      data: targetBigQueryDb,
    })
    return
  }

  const targetAthenaDb = await recoverFromNotFound(
    deleteAthenaDataSource(workspaceId, targetId)
  )
  if (targetAthenaDb) {
    res.status(200).json({
      type: 'athena',
      data: targetAthenaDb,
    })
    return
  }

  const targetOracleDb = await recoverFromNotFound(
    deleteOracleDataSource(workspaceId, targetId)
  )
  if (targetOracleDb) {
    res.status(200).json({
      type: 'oracle',
      data: targetOracleDb,
    })
    return
  }

  const targetMySQLDb = await recoverFromNotFound(
    deleteMySQLDataSource(workspaceId, targetId)
  )
  if (targetMySQLDb) {
    res.status(200).json({
      type: 'mysql',
      data: targetMySQLDb,
    })
    return
  }

  const targetTrinoDb = await recoverFromNotFound(
    deleteTrinoDataSource(workspaceId, targetId)
  )
  if (targetTrinoDb) {
    res.status(200).json({
      type: 'trino',
      data: targetTrinoDb,
    })
    return
  }

  res.status(404).end()
})

const typeSchema = z.object({
  type: z.union([
    z.literal('psql'),
    z.literal('redshift'),
    z.literal('bigquery'),
    z.literal('athena'),
    z.literal('oracle'),
    z.literal('mysql'),
    z.literal('trino'),
  ]),
})
dataSourceRouter.post('/ping', async (req, res) => {
  const result = typeSchema.safeParse(req.body)
  if (!result.success) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')
  const dataSourceId = getParam(req, 'dataSourceId')
  try {
    const dataSource = await getDatasource(
      workspaceId,
      dataSourceId,
      result.data.type
    )

    if (!dataSource) {
      res.status(404).end()
      return
    }

    const ds = await ping(dataSource)

    res.status(200).json({
      lastConnection: ds.data.lastConnection,
      connStatus: ds.data.connStatus,
    })
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        dataSourceId,
        err,
      },
      'Failed to ping data source'
    )
    res.status(500).end()
  }
})

export default dataSourceRouter
