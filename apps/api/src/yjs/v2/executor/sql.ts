import {
  ExecutionQueueItem,
  ExecutionQueueItemSQLLoadPageMetadata,
  ExecutionQueueItemSQLMetadata,
  ExecutionQueueItemSQLRenameDataframeMetadata,
  SQLBlock,
  YBlock,
  getSQLAttributes,
} from '@briefer/editor'
import * as Y from 'yjs'
import prisma, { listDataSources } from '@briefer/database'
import {
  listDataFrames,
  makeSQLQuery,
  readDataframePage,
  renameDataFrame,
} from '../../../python/query/index.js'
import { logger } from '../../../logger.js'
import {
  DataFrame,
  exhaustiveCheck,
  migrateSuccessSQLResult,
  RunQueryResult,
} from '@briefer/types'
import { SQLEvents } from '../../../events/index.js'
import { WSSharedDocV2 } from '../index.js'
import { updateDataframes } from './index.js'
import { advanceTutorial } from '../../../tutorials.js'
import { broadcastTutorialStepStates } from '../../../websocket/workspace/tutorial.js'

export type SQLEffects = {
  makeSQLQuery: typeof makeSQLQuery
  listDataSources: typeof listDataSources
  renameDataFrame: typeof renameDataFrame
  listDataFrames: typeof listDataFrames
  readDataframePage: typeof readDataframePage
  documentHasRunSQLSelectionEnabled: (id: string) => Promise<boolean>
  advanceTutorial: typeof advanceTutorial
  broadcastTutorialStepStates: (
    workspaceId: string,
    tutorialType: 'onboarding'
  ) => Promise<void>
}

export interface ISQLExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLMetadata,
    events: SQLEvents
  ): Promise<void>
  loadPage(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLLoadPageMetadata
  ): Promise<void>
  renameDataframe(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLRenameDataframeMetadata,
    events: SQLEvents
  ): Promise<void>
}

export class SQLExecutor implements ISQLExecutor {
  constructor(
    private readonly sessionId: string,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly dataSourcesEncryptionKey: string,
    private readonly dataframes: Y.Map<DataFrame>,
    private readonly blocks: Y.Map<YBlock>,
    private readonly effects: SQLEffects
  ) {}

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLMetadata,
    events: SQLEvents
  ) {
    events.sqlRun()

    try {
      block.setAttribute('startQueryTime', new Date().toISOString())

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'executing query'
      )

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })
      const {
        id: blockId,
        aiSuggestions,
        source,
        configuration,
        dataSourceId,
        dataframeName,
        isFileDataSource,
        dashboardPageSize,
      } = getSQLAttributes(block, this.blocks)

      if ((!dataSourceId && !isFileDataSource) || !dataframeName) {
        executionItem.setCompleted('error')
        cleanup()
        return
      }

      const datasource = (
        await this.effects.listDataSources(this.workspaceId)
      ).find((ds) => ds.data.id === dataSourceId)

      if (aborted) {
        executionItem.setCompleted('aborted')
        block.setAttribute('result', {
          type: 'abort-error',
          message: 'Query aborted',
        })
        cleanup()
        return
      }

      if (!datasource && !isFileDataSource) {
        // the selected datasource was deleted
        // recover this block state by removing the datasourceId
        block.setAttribute('dataSourceId', null)
        executionItem.setCompleted('error')
        cleanup()
        return
      }

      block.setAttribute('result', null)
      block.setAttribute('page', 0)
      block.setAttribute('sort', null)

      let actualSource =
        (metadata.isSuggestion ? aiSuggestions : source)?.toJSON().trim() ?? ''
      if (metadata.selectedCode) {
        const hasRunSQLSelection =
          await this.effects.documentHasRunSQLSelectionEnabled(this.documentId)
        if (hasRunSQLSelection) {
          actualSource = metadata.selectedCode
        }
      }

      let resultType: RunQueryResult['type'] | 'empty-query' = 'empty-query'
      if (actualSource !== '') {
        const [promise, abort] = await this.effects.makeSQLQuery(
          this.workspaceId,
          this.sessionId,
          blockId,
          dataframeName.value,
          datasource ?? 'duckdb',
          this.dataSourcesEncryptionKey,
          actualSource,
          { pageSize: 50, dashboardPageSize },
          (result) => {
            block.setAttribute('result', result)
          },
          configuration
        )
        cleanup()

        if (aborted) {
          executionItem.setCompleted('aborted')
          await abort()
          await promise
          block.setAttribute('result', {
            type: 'abort-error',
            message: 'Query aborted',
          })
          return
        }

        let abortP = Promise.resolve(false)
        cleanup = executionItem.observeStatus((status) => {
          if (status._tag === 'aborting') {
            abortP = abort().then(() => true)
          }
        })

        const result = await promise
        aborted = await abortP
        if (aborted) {
          executionItem.setCompleted('aborted')
          cleanup()
          block.setAttribute('result', {
            type: 'abort-error',
            message: 'Query aborted',
          })
          return
        }

        block.setAttribute('lastQuery', actualSource)
        block.setAttribute('lastQueryTime', new Date().toISOString())
        if (result.type === 'python-error') {
          logger().error(
            {
              sessionId: this.sessionId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
              err: result,
            },
            'got a python error while running sql query'
          )
          block.setAttribute('result', {
            ...result,
            traceback: [],
          })
        }
        block.setAttribute('result', result)
        if (result.type === 'success') {
          const df = {
            id: blockId,
            name: dataframeName.value,
            columns: result.columns,
            blockId,
            updatedAt: new Date().toISOString(),
          }
          this.dataframes.set(dataframeName.value, df)
        } else if (result.type === 'syntax-error') {
          logger().warn(
            {
              sessionId: this.sessionId,
              workspaceId: this.workspaceId,
              documentId: this.documentId,
              blockId: block.getAttribute('id'),
              err: result,
            },
            'got a syntax error while running sql query'
          )
        }

        resultType = result.type
      }

      executionItem.setCompleted(
        resultType === 'success'
          ? 'success'
          : resultType === 'abort-error'
          ? 'aborted'
          : 'error'
      )

      logger().trace(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          result: resultType,
        },
        'sql block executed'
      )

      const tutorialState = await this.effects.advanceTutorial(
        this.workspaceId,
        'onboarding',
        'runQuery'
      )
      this.effects.broadcastTutorialStepStates(this.workspaceId, 'onboarding')

      if (tutorialState.didAdvance) {
        events.advanceOnboarding('runQuery')
      }
    } catch (err) {
      logger().error(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Error while executin sql block'
      )
      executionItem.setCompleted('error')
    }
  }

  public async loadPage(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    _metadata: ExecutionQueueItemSQLLoadPageMetadata
  ) {
    try {
      const attrs = getSQLAttributes(block, this.blocks)
      const prevResult =
        attrs.result?.type === 'success'
          ? migrateSuccessSQLResult(attrs.result)
          : null
      const queryDurationMs = prevResult?.queryDurationMs

      const nextResult = await this.effects.readDataframePage(
        this.workspaceId,
        this.sessionId,
        attrs.id,
        attrs.dataframeName.value,
        {
          page: attrs.page,
          pageSize: 50,
          dashboardPage: attrs.dashboardPage,
          dashboardPageSize: attrs.dashboardPageSize,
        },
        attrs.sort
      )

      switch (nextResult.type) {
        case 'success':
          block.setAttribute('result', {
            ...nextResult,
            queryDurationMs,
          })
          executionItem.setCompleted('success')
          break
        case 'abort-error':
          block.setAttribute('result', nextResult)
          executionItem.setCompleted('aborted')
          break
        case 'syntax-error':
        case 'python-error':
          block.setAttribute('result', nextResult)
          executionItem.setCompleted('error')
          break
        default:
          exhaustiveCheck(nextResult)
      }

      executionItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          page: block.getAttribute('page'),
          err,
        },
        'Error while loading SQL Block page'
      )

      executionItem.setCompleted('error')
    }
  }

  public async renameDataframe(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    _metadata: ExecutionQueueItemSQLRenameDataframeMetadata
  ) {
    const {
      id: blockId,
      dataframeName,
      result,
    } = getSQLAttributes(block, this.blocks)
    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(dataframeName.newValue)) {
      block.setAttribute('dataframeName', {
        ...dataframeName,
        error: 'invalid-name',
      })
      executionItem.setCompleted('error')
      return
    }

    if (result?.type !== 'success') {
      block.setAttribute('dataframeName', {
        ...dataframeName,
        value: dataframeName.newValue,
      })
      executionItem.setCompleted(
        result?.type === 'abort-error' ? 'aborted' : 'error'
      )
      return
    }

    logger().trace(
      {
        sessionId: this.sessionId,
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        dataframeName,
      },
      'renaming dataframe'
    )

    try {
      await this.effects.renameDataFrame(
        this.workspaceId,
        this.sessionId,
        dataframeName.value,
        dataframeName.newValue
      )

      const dataframes = await this.effects.listDataFrames(
        this.workspaceId,
        this.sessionId
      )

      const blocks = new Set(Array.from(this.blocks.keys()))
      updateDataframes(this.dataframes, dataframes, blockId, blocks)
      block.setAttribute('dataframeName', {
        ...dataframeName,
        value: dataframeName.newValue,
        error: undefined,
      })
      executionItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId,
          err,
        },
        'Error while renaming dataframe'
      )
      executionItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(
    doc: WSSharedDocV2,
    dataSourcesEncryptionKey: string
  ) {
    return new SQLExecutor(
      doc.id,
      doc.workspaceId,
      doc.documentId,
      dataSourcesEncryptionKey,
      doc.dataframes,
      doc.blocks,
      {
        makeSQLQuery,
        listDataSources,
        renameDataFrame,
        listDataFrames,
        advanceTutorial,
        readDataframePage,
        broadcastTutorialStepStates: (
          workspaceId: string,
          tutorialType: 'onboarding'
        ) => {
          return broadcastTutorialStepStates(
            doc.socketServer,
            workspaceId,
            tutorialType
          )
        },
        documentHasRunSQLSelectionEnabled: (id: string) =>
          prisma()
            .document.findFirst({
              where: { id },
              select: { runSQLSelection: true },
            })
            .then((doc) => doc?.runSQLSelection ?? false),
      }
    )
  }
}
