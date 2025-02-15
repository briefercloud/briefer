import { NIL as nilUuid } from 'uuid'
import { Router, Request, Response, NextFunction } from 'express'
import {
  createBigQueryDataSource,
  createPSQLDataSource,
  createRedshiftDataSource,
  getDatasource,
  createAthenaDataSource,
  DataSource,
  createOracleDataSource,
  createMySQLDataSource,
  createTrinoDataSource,
  createSQLServerDataSource,
  createSnowflakeDataSource,
  createDatabricksSQLDataSource,
  getWorkspaceById,
} from '@briefer/database'
import { z } from 'zod'
import { getParam } from '../../../../utils/express.js'
import dataSourceRouter from './data-source.js'
import { config } from '../../../../config/index.js'
import { validate } from 'uuid'
import { ping } from '../../../../datasources/index.js'
import { fetchDataSourceStructure } from '../../../../datasources/structure.js'
import { canUpdateWorkspace } from '../../../../auth/token.js'
import { captureDatasourceCreated } from '../../../../events/posthog.js'
import { IOServer } from '../../../../websocket/index.js'
import { advanceTutorial } from '../../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../../websocket/workspace/tutorial.js'
import * as posthog from '../../../../events/posthog.js'
import { omit } from 'ramda'

const dataSourcePayload = z.union([
  z.object({
    type: z.union([z.literal('psql'), z.literal('redshift')]),
    data: z.object({
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string().min(1),
      username: z.string().min(1),
      password: z.string().min(1),
      notes: z.string(),
      readOnly: z.boolean(),
      cert: z.string().optional(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.union([z.literal('mysql'), z.literal('sqlserver')]),
    data: z.object({
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string().min(1),
      username: z.string().min(1),
      password: z.string().min(1),
      notes: z.string(),
      cert: z.string().optional(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('bigquery'),
    data: z.object({
      name: z.string().min(1),
      projectId: z.string().min(1),
      serviceAccountKey: z.string().min(1),
      notes: z.string(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('athena'),
    data: z.object({
      name: z.string().min(1),
      region: z.string().min(1),
      accessKeyId: z.string().min(1),
      secretAccessKeyId: z.string().min(1),
      s3OutputPath: z.string().min(1),
      notes: z.string(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('oracle'),
    data: z.object({
      name: z.string().min(1),
      host: z.string().min(1),
      port: z.string().min(1),
      database: z.string(),
      serviceName: z.string(),
      sid: z.string(),
      username: z.string().min(1),
      password: z.string().min(1),
      notes: z.string(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('trino'),
    data: z.object({
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
      name: z.string().min(1),
      account: z.string().min(1),
      user: z.string().min(1),
      password: z.string().min(1),
      warehouse: z.string().min(1),
      database: z.string().min(1),
      region: z.string().min(1),
      host: z.string().optional(),
      notes: z.string(),
      additionalInfo: z.string().optional(),
    }),
  }),
  z.object({
    type: z.literal('databrickssql'),
    data: z.object({
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

export type DataSourcePayload = z.infer<typeof dataSourcePayload>

const dataSourcesRouter = (socketServer: IOServer) => {
  const router = Router({ mergeParams: true })

  const neverPingedError = {
    name: 'NeverPingedError',
    message: 'The datasource has never been pinged',
  }

  router.post('/', canUpdateWorkspace, async (req, res) => {
    const result = dataSourcePayload.safeParse(req.body)
    if (!result.success) {
      res.status(400).end()
      return
    }

    const workspaceId = getParam(req, 'workspaceId')

    const data = result.data

    try {
      async function createDataSource(
        data: DataSourcePayload
      ): Promise<DataSource> {
        let dsRes: DataSource

        switch (data.type) {
          case 'psql': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              cert: data.data.cert ?? null,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }
            const ds = await createPSQLDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'psql', data: ds }
            break
          }
          case 'redshift': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              cert: data.data.cert ?? null,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }
            const ds = await createRedshiftDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'redshift', data: ds }
            break
          }
          case 'mysql': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              cert: data.data.cert ?? null,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }
            const ds = await createMySQLDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'mysql', data: ds }
            break
          }
          case 'sqlserver': {
            const payload = {
              workspaceId,
              ...data.data,
              cert: data.data.cert ?? null,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }
            const ds = await createSQLServerDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'sqlserver', data: ds }
            break
          }
          case 'bigquery': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }
            const ds = await createBigQueryDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'bigquery', data: ds }
            break
          }
          case 'athena': {
            const payload = {
              ...data.data,
              s3OutputPath: data.data.s3OutputPath.endsWith('/')
                ? data.data.s3OutputPath
                : `${data.data.s3OutputPath}/`,
              workspaceId,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }

            const ds = await createAthenaDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'athena', data: ds }
            break
          }
          case 'oracle': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }

            const ds = await createOracleDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )

            dsRes = { type: 'oracle', data: ds }
            break
          }
          case 'trino': {
            const payload = {
              ...data.data,
              workspaceId,
              password: data.data.password !== '' ? data.data.password : null,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }

            const ds = await createTrinoDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'trino', data: ds }
            break
          }
          case 'snowflake': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              region: data.data.region,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }

            const ds = await createSnowflakeDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'snowflake', data: ds }
            break
          }
          case 'databrickssql': {
            const payload = {
              ...omit(['additionalInfo'], data.data),
              workspaceId,
              connStatus: 'offline' as const,
              connError: JSON.stringify(neverPingedError),
              lastConnection: null,
              isDefault: false,
            }

            const ds = await createDatabricksSQLDataSource(
              payload,
              config().DATASOURCES_ENCRYPTION_KEY
            )
            dsRes = { type: 'databrickssql', data: ds }
            break
          }
        }

        return dsRes
      }

      function validateDataSource(data: DataSourcePayload): string | null {
        switch (data.type) {
          case 'psql':
          case 'mysql':
          case 'redshift':
          case 'bigquery':
          case 'athena':
          case 'sqlserver':
          case 'snowflake':
          case 'databrickssql':
          case 'trino':
            return null
          case 'oracle': {
            if (
              !data.data.sid &&
              !data.data.serviceName &&
              !data.data.database
            ) {
              return 'Either service name, database or SID must be provided'
            }

            return null
          }
        }
      }

      const error = validateDataSource(data)
      if (error) {
        res.status(400).json({ error })
        return
      }

      const datasource = await createDataSource(data).then((ds) =>
        ping(req.session.user, socketServer, {
          config: ds,
          structure: {
            // placeholder id 00000000-0000-0000-0000-000000000000
            id: nilUuid,
            status: 'loading',
            startedAt: Date.now(),
            loadingPing: 0,
            version: 3,
          },
        })
      )

      await fetchDataSourceStructure(socketServer, datasource.config, {
        forceRefresh: true,
        additionalInfo: data.data.additionalInfo,
      })

      res.status(201).json(datasource)

      const tutorialState = await advanceTutorial(
        workspaceId,
        'onboarding',
        'connectDataSource'
      )
      broadcastTutorialStepStates(socketServer, workspaceId, 'onboarding')

      const workspace = await getWorkspaceById(workspaceId)
      if (workspace) {
        captureDatasourceCreated(
          req.session.user,
          workspaceId,
          workspace.name,
          datasource.config.data.id,
          data.type
        )
      }

      if (tutorialState.prevStep && tutorialState.didAdvance) {
        posthog.captureOnboardingStep(
          req.session.user.id,
          workspaceId,
          tutorialState.prevStep,
          false
        )
      }
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          dataSourceType: data.type,
          err,
        },
        'Failed to create data source'
      )
      res.sendStatus(500)
    }
  })

  async function belongsToWorkspace(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const workspaceId = getParam(req, 'workspaceId')
    const dataSourceId = getParam(req, 'dataSourceId')

    if (!validate(dataSourceId) || !validate(workspaceId)) {
      res.status(400).end()
      return
    }

    const dataSource = (
      await Promise.all([
        getDatasource(workspaceId, dataSourceId, 'psql'),
        getDatasource(workspaceId, dataSourceId, 'bigquery'),
        getDatasource(workspaceId, dataSourceId, 'redshift'),
        getDatasource(workspaceId, dataSourceId, 'athena'),
        getDatasource(workspaceId, dataSourceId, 'oracle'),
        getDatasource(workspaceId, dataSourceId, 'mysql'),
        getDatasource(workspaceId, dataSourceId, 'sqlserver'),
        getDatasource(workspaceId, dataSourceId, 'trino'),
        getDatasource(workspaceId, dataSourceId, 'snowflake'),
        getDatasource(workspaceId, dataSourceId, 'databrickssql'),
      ])
    ).find((e) => e !== null)

    if (!dataSource) {
      res.status(404).end()
      return
    }

    if (dataSource.data.workspaceId !== workspaceId) {
      res.status(403).end()
      return
    }

    next()
  }

  router.use(
    '/:dataSourceId',
    canUpdateWorkspace,
    belongsToWorkspace,
    dataSourceRouter(socketServer)
  )

  return router
}

export default dataSourcesRouter
