import {
  ExecutionQueueItem,
  ExecutionQueueItemSQLMetadata,
  SQLBlock,
  YBlock,
  getSQLAttributes,
} from '@briefer/editor'
import * as Y from 'yjs'
import prisma, { listDataSources } from '@briefer/database'
import { makeSQLQuery } from '../../../python/query/index.js'
import { logger } from '../../../logger.js'
import { DataFrame, RunQueryResult } from '@briefer/types'
import { SQLEvents } from '../../../events/index.js'
import { WSSharedDocV2 } from '../index.js'

export type SQLEffects = {
  makeSQLQuery: typeof makeSQLQuery
  listDataSources: typeof listDataSources
  documentHasRunSQLSelectionEnabled: (id: string) => Promise<boolean>
}

export interface ISQLExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLMetadata
  ): Promise<void>
}

export class SQLExecutor implements ISQLExecutor {
  private workspaceId: string
  private documentId: string
  private dataSourcesEncryptionKey: string
  private dataframes: Y.Map<DataFrame>
  private blocks: Y.Map<YBlock>
  private effects: SQLEffects
  private events: SQLEvents

  constructor(
    workspaceId: string,
    documentId: string,
    dataSourcesEncryptionKey: string,
    dataframes: Y.Map<DataFrame>,
    blocks: Y.Map<YBlock>,
    effects: SQLEffects,
    events: SQLEvents
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.dataSourcesEncryptionKey = dataSourcesEncryptionKey
    this.dataframes = dataframes
    this.blocks = blocks
    this.effects = effects
    this.events = events
  }

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: ExecutionQueueItemSQLMetadata
  ) {
    // TODO
    // this.events.sqlRun(EventContext.fromYTransaction(tr))

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
      } = getSQLAttributes(block, this.blocks)

      if ((!dataSourceId && !isFileDataSource) || !dataframeName) {
        executionItem.setSuccess()
        return
      }

      const datasource = (
        await this.effects.listDataSources(this.workspaceId)
      ).find((ds) => ds.data.id === dataSourceId)

      if (aborted) {
        executionItem.setAborted()
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
        block.removeAttribute('dataSourceId')
        executionItem.setSuccess()
        cleanup()
        return
      }

      block.removeAttribute('result')

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
          this.documentId,
          blockId,
          dataframeName.value,
          datasource ?? 'duckdb',
          this.dataSourcesEncryptionKey,
          actualSource,
          (result) => {
            block.setAttribute('result', result)
          },
          configuration
        )
        cleanup()

        if (aborted) {
          executionItem.setAborted()
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
          executionItem.setAborted()
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

      if (resultType === 'success') {
        executionItem.setSuccess()
      } else {
        executionItem.setError()
      }

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          result: resultType,
        },
        'sql block executed'
      )
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Error while executin sql block'
      )
      executionItem.setError()
    }
  }

  public static fromWSSharedDocV2(
    doc: WSSharedDocV2,
    dataSourcesEncryptionKey: string,
    events: SQLEvents
  ) {
    return new SQLExecutor(
      doc.workspaceId,
      doc.documentId,
      dataSourcesEncryptionKey,
      doc.dataframes,
      doc.blocks,
      {
        makeSQLQuery,
        listDataSources,
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
