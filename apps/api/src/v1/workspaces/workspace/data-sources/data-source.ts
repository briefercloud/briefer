import { omit } from 'ramda'
import { Router } from 'express'
import prisma, {
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
  deleteSQLServerDataSource,
  getSQLServerDataSource,
  updateSQLServerDataSource,
  getSnowflakeDataSource,
  updateSnowflakeDataSource,
  deleteSnowflakeDataSource,
  getDatabricksSQLDataSource,
  updateDatabricksSQLDataSource,
  deleteDatabricksSQLDataSource,
  listDataSources,
  DataSource,
} from '@briefer/database'
import { z } from 'zod'
import { getParam } from '../../../../utils/express.js'
import { config } from '../../../../config/index.js'
import { ping } from '../../../../datasources/index.js'
import { fetchDataSourceStructure } from '../../../../datasources/structure.js'
import {
  broadcastDataSource,
  broadcastDataSources,
} from '../../../../websocket/workspace/data-sources.js'
import { IOServer } from '../../../../websocket/index.js'
import { exhaustiveCheck } from '@briefer/types'

const dataSourceRouter = (socketServer: IOServer) => {
  const router = Router({ mergeParams: true })

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
        additionalInfo: z.string().optional(),
      }),
    }),
    z.object({
      type: z.union([z.literal('mysql'), z.literal('sqlserver')]),
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
        additionalInfo: z.string().optional(),
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
        additionalInfo: z.string().optional(),
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
        additionalInfo: z.string().optional(),
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
        additionalInfo: z.string().optional(),
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
        additionalInfo: z.string().optional(),
      }),
    }),
    z.object({
      type: z.literal('snowflake'),
      data: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        account: z.string().min(1),
        user: z.string().min(1),
        password: z.string(),
        warehouse: z.string().min(1),
        database: z.string().min(1),
        region: z.string().optional(),
        notes: z.string(),
        additionalInfo: z.string().optional(),
      }),
    }),
    z.object({
      type: z.literal('databrickssql'),
      data: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        hostname: z.string().min(1),
        http_path: z.string().min(1),
        token: z.string().min(1),
        catalog: z.string(),
        schema: z.string(),
        notes: z.string(),
        additionalInfo: z.string().optional(),
      }),
    }),
  ])

  router.put('/', async (req, res) => {
    const payload = dataSourceSchema.safeParse(req.body)
    if (!payload.success) {
      res.status(400).end()
      return
    }

    const workspaceId = getParam(req, 'workspaceId')
    const dataSourceId = getParam(req, 'dataSourceId')
    const data = payload.data
    const existingDb = (
      await Promise.all([
        getPSQLDataSource(workspaceId, dataSourceId),
        getBigQueryDataSource(workspaceId, dataSourceId),
        getRedshiftDataSource(workspaceId, dataSourceId),
        getAthenaDataSource(workspaceId, dataSourceId),
        getOracleDataSource(workspaceId, dataSourceId),
        getMySQLDataSource(workspaceId, dataSourceId),
        getSQLServerDataSource(workspaceId, dataSourceId),
        getTrinoDataSource(workspaceId, dataSourceId),
        getSnowflakeDataSource(workspaceId, dataSourceId),
        getDatabricksSQLDataSource(workspaceId, dataSourceId),
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
        await updatePSQLDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'mysql': {
        await updateMySQLDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'sqlserver': {
        await updateSQLServerDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'redshift': {
        await updateRedshiftDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'bigquery': {
        await updateBigQueryDataSource(
          {
            ...omit(['additionalInfo'], data.data),
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
        break
      }
      case 'athena': {
        await updateAthenaDataSource(
          {
            ...omit(['additionalInfo'], data.data),
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
        break
      }
      case 'oracle': {
        if (!data.data.sid && !data.data.serviceName && !data.data.database) {
          res.status(400).json({
            error: 'Either service name, database or SID must be provided',
          })
          return
        }

        await updateOracleDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'trino': {
        await updateTrinoDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'snowflake': {
        await updateSnowflakeDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            password:
              data.data.password === '' ? undefined : data.data.password,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
        break
      }
      case 'databrickssql': {
        await updateDatabricksSQLDataSource(
          {
            ...omit(['additionalInfo'], data.data),
            id: dataSourceId,
            token: data.data.token === '' ? undefined : data.data.token,
          },
          config().DATASOURCES_ENCRYPTION_KEY
        )
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

    const structure = await fetchDataSourceStructure(socketServer, ds, {
      forceRefresh: true,
      additionalInfo: data.data.additionalInfo,
    })

    const result = await ping(req.session.user, socketServer, {
      config: ds,
      structure,
    })
    res.json(result)
  })

  router.delete('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const targetId = getParam(req, 'dataSourceId')

    const run = async () => {
      const targetPsqlDb = await recoverFromNotFound(
        deletePSQLDataSource(workspaceId, targetId)
      )
      if (targetPsqlDb) {
        return {
          status: 200,
          payload: {
            type: 'psql',
            data: targetPsqlDb,
          },
        }
      }

      const targetRedshiftDb = await recoverFromNotFound(
        deleteRedshiftDataSource(targetId)
      )
      if (targetRedshiftDb) {
        return {
          status: 200,
          payload: {
            type: 'redshift',
            data: targetRedshiftDb,
          },
        }
      }

      const targetBigQueryDb = await recoverFromNotFound(
        deleteBigQueryDataSource(targetId)
      )
      if (targetBigQueryDb) {
        return {
          status: 200,
          payload: {
            type: 'bigquery',
            data: targetBigQueryDb,
          },
        }
      }

      const targetAthenaDb = await recoverFromNotFound(
        deleteAthenaDataSource(workspaceId, targetId)
      )
      if (targetAthenaDb) {
        return {
          status: 200,
          payload: {
            type: 'athena',
            data: targetAthenaDb,
          },
        }
      }

      const targetOracleDb = await recoverFromNotFound(
        deleteOracleDataSource(workspaceId, targetId)
      )
      if (targetOracleDb) {
        return {
          status: 200,
          payload: {
            type: 'oracle',
            data: targetOracleDb,
          },
        }
      }

      const targetMySQLDb = await recoverFromNotFound(
        deleteMySQLDataSource(workspaceId, targetId)
      )
      if (targetMySQLDb) {
        return {
          status: 200,
          payload: {
            type: 'mysql',
            data: targetMySQLDb,
          },
        }
      }

      const targetSQLServerDb = await recoverFromNotFound(
        deleteSQLServerDataSource(workspaceId, targetId)
      )
      if (targetSQLServerDb) {
        return {
          status: 200,
          payload: {
            type: 'sqlserver',
            data: targetSQLServerDb,
          },
        }
      }

      const targetTrinoDb = await recoverFromNotFound(
        deleteTrinoDataSource(workspaceId, targetId)
      )
      if (targetTrinoDb) {
        return {
          status: 200,
          payload: {
            type: 'trino',
            data: targetTrinoDb,
          },
        }
      }

      const targetSnowflakeDb = await recoverFromNotFound(
        deleteSnowflakeDataSource(workspaceId, targetId)
      )
      if (targetSnowflakeDb) {
        return {
          status: 200,
          payload: {
            type: 'snowflake',
            data: targetSnowflakeDb,
          },
        }
      }

      const targetDatabricksSQLDb = await recoverFromNotFound(
        deleteDatabricksSQLDataSource(workspaceId, targetId)
      )
      if (targetDatabricksSQLDb) {
        return {
          status: 200,
          payload: {
            type: 'databrickssql',
            data: targetDatabricksSQLDb,
          },
        }
      }

      return { status: 404 }
    }

    const { status, payload } = await run()
    await broadcastDataSources(socketServer, workspaceId)

    if (payload) {
      res.status(status).json(payload)
    } else {
      res.status(status).end()
    }
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
      z.literal('sqlserver'),
      z.literal('snowflake'),
      z.literal('databrickssql'),
    ]),
  })
  router.post('/ping', async (req, res) => {
    const result = typeSchema.safeParse(req.body)
    if (!result.success) {
      res.status(400).end()
      return
    }

    const workspaceId = getParam(req, 'workspaceId')
    const dataSourceId = getParam(req, 'dataSourceId')
    try {
      const dsConfig = await getDatasource(
        workspaceId,
        dataSourceId,
        result.data.type
      )
      if (!dsConfig) {
        res.status(404).end()
        return
      }

      const structure = await fetchDataSourceStructure(socketServer, dsConfig, {
        forceRefresh: false,
      })

      const ds = await ping(req.session.user, socketServer, {
        config: dsConfig,
        structure,
      })

      broadcastDataSource(socketServer, ds)

      res.json({
        lastConnection: dsConfig.data.lastConnection,
        connStatus: dsConfig.data.connStatus,
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

  router.post('/default', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const dataSourceId = getParam(req, 'dataSourceId')
    try {
      const dataSources = await listDataSources(workspaceId)
      const dataSource = dataSources.find((ds) => ds.data.id === dataSourceId)
      if (!dataSource) {
        res.status(404).end()
        return
      }

      const actions = dataSources
        .filter((ds) => ds.data.isDefault && ds.data.id !== dataSource.data.id)
        .map((ds) => ({
          type: ds.type,
          id: ds.data.id,
          isDefault: false,
        }))
        .concat([
          { type: dataSource.type, id: dataSource.data.id, isDefault: true },
        ])

      await prisma().$transaction((tx) =>
        Promise.all(
          actions.map((ds) => {
            switch (ds.type) {
              case 'psql':
                return tx.postgreSQLDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'mysql':
                return tx.mySQLDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'trino':
                return tx.trinoDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'athena':
                return tx.athenaDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'oracle':
                return tx.oracleDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'bigquery':
                return tx.bigQueryDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'redshift':
                return tx.redshiftDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'sqlserver':
                return tx.sQLServerDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'snowflake':
                return tx.snowflakeDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              case 'databrickssql':
                return tx.databricksSQLDataSource.update({
                  where: { id: ds.id },
                  data: { isDefault: ds.isDefault },
                })
              default:
                exhaustiveCheck(ds.type)
            }
          })
        )
      )
      await broadcastDataSources(socketServer, workspaceId)
      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          dataSourceId,
          err,
        },
        'Failed to set data source as default'
      )
      res.status(500).end()
    }
  })

  return router
}

export default dataSourceRouter
