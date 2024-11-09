import debounce from 'lodash.debounce'
import {
  SQLBlock,
  YBlock,
  closeSQLEditWithAIPrompt,
  getBaseAttributes,
  getSQLAttributes,
  updateSQLAISuggestions,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import prisma, {
  getCredentialsInfo,
  getDatabaseURL,
  listDataSources,
  getWorkspaceWithSecrets,
} from '@briefer/database'
import {
  listDataFrames,
  makeSQLQuery,
  renameDataFrame,
} from '../../../../python/query/index.js'
import { updateDataframes } from '../index.js'
import { logger } from '../../../../logger.js'
import { DataFrame, RunQueryResult } from '@briefer/types'
import { sqlEditStreamed } from '../../../../ai-api.js'
import { config } from '../../../../config/index.js'
import { EventContext, SQLEvents } from '../../../../events/index.js'
import {
  IJupyterManager,
  getJupyterManager,
} from '../../../../jupyter/index.js'

async function editWithAI(
  workspaceId: string,
  datasourceId:
    | {
        type: 'db'
        id: string
      }
    | { type: 'duckdb' },
  source: string,
  instructions: string,
  event: (modelId: string | null) => void,
  onSuggestions: (suggestions: string) => void
) {
  const workspace = workspaceId
    ? await getWorkspaceWithSecrets(workspaceId)
    : null

  const assistantModelId = workspace?.assistantModel ?? null

  if (datasourceId.type === 'duckdb') {
    event(assistantModelId)

    return sqlEditStreamed(
      'duckdb',
      source,
      instructions,
      null,
      onSuggestions,
      assistantModelId,
      workspace?.secrets?.openAiApiKey ?? null
    )
  }

  const dataSources = await listDataSources(workspaceId)
  const dataSource = dataSources.find((ds) => ds.data.id === datasourceId.id)
  if (!dataSource) {
    throw new Error(`Datasource with id ${datasourceId} not found`)
  }

  const [databaseURL, credentialsInfo] = await Promise.all([
    getDatabaseURL(dataSource, config().DATASOURCES_ENCRYPTION_KEY),
    getCredentialsInfo(dataSource, config().DATASOURCES_ENCRYPTION_KEY),
  ])

  event(assistantModelId)

  return sqlEditStreamed(
    databaseURL,
    source,
    instructions,
    credentialsInfo,
    onSuggestions,
    assistantModelId,
    workspace?.secrets?.openAiApiKey ?? null
  )
}

export type SQLEffects = {
  makeSQLQuery: typeof makeSQLQuery
  renameDataFrame: typeof renameDataFrame
  listDataSources: typeof listDataSources
  listDataFrames: typeof listDataFrames
  editWithAI: typeof editWithAI
  documentHasRunSQLSelectionEnabled: (id: string) => Promise<boolean>
}

type RunninQuery = {
  abortController: AbortController
  abort?: () => Promise<void>
}

export interface ISQLExecutor {
  isIdle(): boolean
  runQuery(
    block: Y.XmlElement<SQLBlock>,
    tr: Y.Transaction,
    isSuggestion: boolean,
    isRunAll: boolean
  ): Promise<void>
  abortQuery(block: Y.XmlElement<SQLBlock>): Promise<void>
  renameDataFrame(block: Y.XmlElement<SQLBlock>): Promise<void>
  editWithAI(block: Y.XmlElement<SQLBlock>, tr: Y.Transaction): Promise<void>
  fixWithAI(block: Y.XmlElement<SQLBlock>, tr: Y.Transaction): Promise<void>
}

export class SQLExecutor implements ISQLExecutor {
  private workspaceId: string
  private documentId: string
  private dataSourcesEncryptionKey: string
  private executionQueue: PQueue
  private dataframes: Y.Map<DataFrame>
  private blocks: Y.Map<YBlock>
  private runningQueries = new Map<Y.XmlElement<SQLBlock>, RunninQuery>()
  private jupyterManager: IJupyterManager
  private effects: SQLEffects
  private events: SQLEvents

  constructor(
    workspaceId: string,
    documentId: string,
    dataSourcesEncryptionKey: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    jupyterManager: IJupyterManager,
    effects: SQLEffects,
    events: SQLEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataSourcesEncryptionKey = dataSourcesEncryptionKey
    this.dataframes = dataframes
    this.blocks = blocks
    this.executionQueue = executionQueue
    this.jupyterManager = jupyterManager
    this.effects = effects
    this.events = events
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async runQuery(
    block: Y.XmlElement<SQLBlock>,
    tr: Y.Transaction,
    isSuggestion: boolean,
    isRunAll: boolean
  ) {
    // this.events.sqlRun(EventContext.fromYTransaction(tr))
    // const abortController = new AbortController()
    // const runningQuery: RunninQuery = { abortController }
    // this.runningQueries.set(block, runningQuery)
    // try {
    //   logger().trace(
    //     {
    //       workspaceId: this.workspaceId,
    //       documentId: this.documentId,
    //       blockId: block.getAttribute('id'),
    //       queueSize: this.executionQueue.size,
    //     },
    //     'enqueuing query execution'
    //   )
    //   await this.executionQueue.add(
    //     async ({ signal }) => {
    //       block.setAttribute('startQueryTime', new Date().toISOString())
    //       logger().trace(
    //         {
    //           workspaceId: this.workspaceId,
    //           documentId: this.documentId,
    //           blockId: block.getAttribute('id'),
    //         },
    //         'executing query'
    //       )
    //       const {
    //         id: blockId,
    //         aiSuggestions,
    //         source,
    //         configuration,
    //         dataSourceId,
    //         dataframeName,
    //         isFileDataSource,
    //         selectedCode,
    //       } = getSQLAttributes(block, this.blocks)
    //       if ((!dataSourceId && !isFileDataSource) || !dataframeName) {
    //         return
    //       }
    //       const datasource = (
    //         await this.effects.listDataSources(this.workspaceId)
    //       ).find((ds) => ds.data.id === dataSourceId)
    //       if (signal?.aborted) {
    //         block.setAttribute('result', {
    //           type: 'abort-error',
    //           message: 'Query aborted',
    //         })
    //         return
    //       }
    //       if (!datasource && !isFileDataSource) {
    //         // the selected datasource was deleted
    //         // recover this block state by removing the datasourceId
    //         block.removeAttribute('dataSourceId')
    //         return
    //       }
    //       block.removeAttribute('result')
    //       let actualSource =
    //         (isSuggestion ? aiSuggestions : source)?.toJSON().trim() ?? ''
    //       if (!isRunAll && selectedCode) {
    //         const hasRunSQLSelection =
    //           await this.effects.documentHasRunSQLSelectionEnabled(
    //             this.documentId
    //           )
    //         if (hasRunSQLSelection) {
    //           actualSource = selectedCode.trim()
    //         }
    //       }
    //       let resultType: RunQueryResult['type'] | 'empty-query' = 'empty-query'
    //       if (actualSource !== '') {
    //         const [promise, abort] = await this.effects.makeSQLQuery(
    //           this.workspaceId,
    //           this.documentId,
    //           blockId,
    //           dataframeName.value,
    //           datasource ?? 'duckdb',
    //           this.dataSourcesEncryptionKey,
    //           actualSource,
    //           (result) => {
    //             block.setAttribute('result', result)
    //           },
    //           configuration
    //         )
    //         runningQuery.abort = abort
    //         if (signal?.aborted) {
    //           await abort()
    //         }
    //         const result = await promise
    //         block.setAttribute('lastQuery', actualSource)
    //         block.setAttribute('lastQueryTime', new Date().toISOString())
    //         if (result.type === 'python-error') {
    //           logger().error(
    //             {
    //               workspaceId: this.workspaceId,
    //               documentId: this.documentId,
    //               blockId: block.getAttribute('id'),
    //               err: result,
    //             },
    //             'got a python error while running sql query'
    //           )
    //           block.setAttribute('result', {
    //             ...result,
    //             traceback: [],
    //           })
    //         }
    //         block.setAttribute('result', result)
    //         if (result.type === 'success') {
    //           const df = {
    //             id: blockId,
    //             name: dataframeName.value,
    //             columns: result.columns,
    //             blockId,
    //             updatedAt: new Date().toISOString(),
    //           }
    //           this.dataframes.set(dataframeName.value, df)
    //         } else if (result.type === 'syntax-error') {
    //           logger().warn(
    //             {
    //               workspaceId: this.workspaceId,
    //               documentId: this.documentId,
    //               blockId: block.getAttribute('id'),
    //               err: result,
    //             },
    //             'got a syntax error while running sql query'
    //           )
    //         }
    //         resultType = result.type
    //       }
    //       logger().trace(
    //         {
    //           workspaceId: this.workspaceId,
    //           documentId: this.documentId,
    //           blockId: block.getAttribute('id'),
    //           result: resultType,
    //         },
    //         'query executed'
    //       )
    //     },
    //     { signal: abortController.signal }
    //   )
    // } catch (e) {
    //   if (e instanceof DOMException && e.name === 'AbortError') {
    //     block.setAttribute('result', {
    //       type: 'abort-error',
    //       message: 'Query aborted',
    //     })
    //     return
    //   }
    //   throw e
    // }
  }

  public async abortQuery(block: Y.XmlElement<SQLBlock>) {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'aborting query'
    )

    const query = this.runningQueries.get(block)
    if (!query) {
      return
    }

    query.abortController.abort()
    await query.abort?.()

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'query aborted'
    )
  }

  public async renameDataFrame(block: Y.XmlElement<SQLBlock>) {
    // const dataframeName = block.getAttribute('dataframeName')
    // if (!dataframeName) {
    //   return
    // }
    // const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    // if (!dfNameRegex.test(dataframeName.newValue)) {
    //   block.setAttribute('dataframeName', {
    //     ...dataframeName,
    //     error: 'invalid-name',
    //   })
    //   return
    // }
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     dataframeName,
    //   },
    //   'renaming dataframe'
    // )
    // const result = block.getAttribute('result')
    // const isQueryRunning = block.getAttribute('status') !== 'idle'
    // if (result?.type !== 'success' || isQueryRunning) {
    //   block.setAttribute('dataframeName', {
    //     ...dataframeName,
    //     value: dataframeName.newValue,
    //   })
    //   return
    // }
    // if (!(await this.jupyterManager.isRunning(this.workspaceId))) {
    //   block.setAttribute('dataframeName', {
    //     ...dataframeName,
    //     value: dataframeName.newValue,
    //   })
    //   return
    // }
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     dataframeName,
    //     queueSize: this.executionQueue.size,
    //   },
    //   'enqueuing dataframe rename'
    // )
    // await this.executionQueue.add(async () => {
    //   logger().trace(
    //     {
    //       workspaceId: this.workspaceId,
    //       documentId: this.documentId,
    //       blockId: block.getAttribute('id'),
    //       dataframeName,
    //     },
    //     'renaming dataframe in jupyter'
    //   )
    //   await this.effects.renameDataFrame(
    //     this.workspaceId,
    //     this.documentId,
    //     dataframeName.value,
    //     dataframeName.newValue
    //   )
    //   const dataframes = await this.effects.listDataFrames(
    //     this.workspaceId,
    //     this.documentId
    //   )
    //   const { id: blockId } = getBaseAttributes(block)
    //   const blocks = new Set(Array.from(this.blocks.keys()))
    //   updateDataframes(this.dataframes, dataframes, blockId, blocks)
    //   block.setAttribute('dataframeName', {
    //     ...dataframeName,
    //     value: dataframeName.newValue,
    //     error: undefined,
    //   })
    // })
    // logger().trace(
    //   {
    //     workspaceId: this.workspaceId,
    //     documentId: this.documentId,
    //     blockId: block.getAttribute('id'),
    //     dataframeName,
    //   },
    //   'dataframe renamed in jupyter'
    // )
  }

  public async editWithAI(block: Y.XmlElement<SQLBlock>, tr: Y.Transaction) {
    // TODO: this should make isIdle return true while it is running

    const {
      dataSourceId: datasourceId,
      isFileDataSource,
      source,
      editWithAIPrompt,
    } = getSQLAttributes(block, this.blocks)

    const instructions = editWithAIPrompt?.toJSON() ?? ''

    if ((!datasourceId && !isFileDataSource) || !instructions) {
      return
    }

    const callback = debounce((suggestions) => {
      // const status = block.getAttribute('status')
      // if (status !== 'edit-with-ai-running') {
      //   abortController.abort()
      // } else {
      //   updateSQLAISuggestions(block, suggestions)
      // }
    }, 50)
    const { promise, abortController } = await this.effects.editWithAI(
      this.workspaceId,
      datasourceId ? { type: 'db', id: datasourceId } : { type: 'duckdb' },
      source?.toJSON() ?? '',
      instructions,
      (modelId) => {
        this.events.aiUsage(
          EventContext.fromYTransaction(tr),
          'sql',
          'edit',
          modelId
        )
      },
      callback
    )

    await promise
    callback.flush()
    closeSQLEditWithAIPrompt(block, true)
  }

  public async fixWithAI(block: Y.XmlElement<SQLBlock>, tr: Y.Transaction) {
    // TODO: this should make isIdle return true while it is running
    const { dataSourceId, isFileDataSource } = getSQLAttributes(
      block,
      this.blocks
    )
    if (!dataSourceId && !isFileDataSource) {
      return
    }

    const error = block.getAttribute('result')
    if (!error || error.type !== 'syntax-error') {
      return
    }

    const instructions = `Fix the query, this is the error: ${error.message}`

    const source = block.getAttribute('source')?.toJSON() ?? ''

    const callback = debounce((suggestions) => {
      // const status = block.getAttribute('status')
      // if (status !== 'fix-with-ai-running') {
      //   abortController.abort()
      // } else {
      //   updateSQLAISuggestions(block, suggestions)
      // }
    }, 50)

    const { promise, abortController } = await this.effects.editWithAI(
      this.workspaceId,
      dataSourceId ? { type: 'db', id: dataSourceId } : { type: 'duckdb' },
      source,
      instructions,
      (modelId) => {
        this.events.aiUsage(
          EventContext.fromYTransaction(tr),
          'sql',
          'fix',
          modelId
        )
      },
      callback
    )

    await promise
    callback.flush()
  }

  public static make(
    workspaceId: string,
    documentId: string,
    dataSourcesEncryptionKey: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    events: SQLEvents
  ) {
    return new SQLExecutor(
      workspaceId,
      documentId,
      dataSourcesEncryptionKey,
      dataframes,
      blocks,
      executionQueue,
      getJupyterManager(),
      {
        makeSQLQuery,
        renameDataFrame,
        listDataSources,
        listDataFrames,
        editWithAI,
        documentHasRunSQLSelectionEnabled: (id: string) =>
          prisma()
            .document.findFirst({
              where: { id },
              select: { runSQLSelection: true },
            })
            .then((doc) => doc?.runSQLSelection ?? false),
      },
      events
    )
  }
}
