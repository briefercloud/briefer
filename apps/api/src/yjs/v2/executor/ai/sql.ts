import debounce from 'lodash.debounce'
import {
  AITaskItem,
  AITaskItemEditSQLMetadata,
  AITaskItemFixSQLMetadata,
  SQLBlock,
  YBlock,
  closeSQLEditWithAIPrompt,
  getSQLAttributes,
  updateSQLAISuggestions,
} from '@briefer/editor'
import * as Y from 'yjs'
import {
  getCredentialsInfo,
  getDatabaseURL,
  listDataSources,
  getWorkspaceWithSecrets,
} from '@briefer/database'
import { logger } from '../../../../logger.js'
import { sqlEditStreamed } from '../../../../ai-api.js'
import { config } from '../../../../config/index.js'
import { AIEvents } from '../../../../events/index.js'
import { WSSharedDocV2 } from '../../index.js'
import { CanceledError } from 'axios'

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

export interface ISQLAIExecutor {
  editWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: AITaskItemEditSQLMetadata,
    events: AIEvents
  ): Promise<void>
  fixWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<SQLBlock>,
    metadata: AITaskItemFixSQLMetadata,
    events: AIEvents
  ): Promise<void>
}

export class AISQLExecutor implements ISQLAIExecutor {
  constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly blocks: Y.Map<YBlock>,
    private readonly effects: { editWithAI: typeof editWithAI }
  ) {}

  public async editWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<SQLBlock>,
    _metadata: AITaskItemEditSQLMetadata,
    events: AIEvents
  ): Promise<void> {
    let cleanup: () => void = () => {}
    let aborted = false
    try {
      cleanup = taskItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      const {
        dataSourceId: datasourceId,
        isFileDataSource,
        source,
        editWithAIPrompt,
      } = getSQLAttributes(block, this.blocks)

      const instructions = editWithAIPrompt?.toJSON() ?? ''

      if ((!datasourceId && !isFileDataSource) || !instructions) {
        taskItem.setCompleted('error')
        return
      }

      const callback = debounce((suggestions) => {
        if (aborted) {
          return
        }

        updateSQLAISuggestions(block, suggestions)
      }, 50)

      const { promise, abortController } = await this.effects.editWithAI(
        this.workspaceId,
        datasourceId ? { type: 'db', id: datasourceId } : { type: 'duckdb' },
        source?.toJSON() ?? '',
        instructions,
        (modelId) => {
          events.aiUsage('sql', 'edit', modelId)
        },
        callback
      )

      if (aborted) {
        abortController.abort()
        taskItem.setCompleted('aborted')
        cleanup()
        return
      }

      cleanup = taskItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          abortController.abort()
          aborted = true
        }
      })

      await promise
      callback.flush()
      closeSQLEditWithAIPrompt(block, true)
      taskItem.setCompleted(aborted ? 'aborted' : 'success')
    } catch (err) {
      if (err instanceof CanceledError) {
        taskItem.setCompleted('aborted')
        return
      }

      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: taskItem.getUserId(),
          err,
        },
        'Error editing SQL block with AI'
      )
      taskItem.setCompleted('error')
    } finally {
      cleanup()
    }
  }

  public async fixWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<SQLBlock>,
    _metadata: AITaskItemFixSQLMetadata,
    events: AIEvents
  ): Promise<void> {
    let cleanup: () => void = () => {}
    let aborted = false
    try {
      cleanup = taskItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      const { dataSourceId, isFileDataSource } = getSQLAttributes(
        block,
        this.blocks
      )
      if (!dataSourceId && !isFileDataSource) {
        taskItem.setCompleted('error')
        return
      }

      const error = block.getAttribute('result')
      if (!error || error.type !== 'syntax-error') {
        taskItem.setCompleted('error')
        return
      }

      const instructions = `Fix the query, this is the error: ${error.message}`

      const source = block.getAttribute('source')?.toJSON() ?? ''

      const callback = debounce((suggestions) => {
        if (aborted) {
          return
        }

        updateSQLAISuggestions(block, suggestions)
      }, 50)

      const { promise, abortController } = await this.effects.editWithAI(
        this.workspaceId,
        dataSourceId ? { type: 'db', id: dataSourceId } : { type: 'duckdb' },
        source,
        instructions,
        (modelId) => {
          events.aiUsage('sql', 'fix', modelId)
        },
        callback
      )

      if (aborted) {
        abortController.abort()
        taskItem.setCompleted('aborted')
        return
      }

      cleanup()
      cleanup = taskItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          abortController.abort()
          aborted = true
        }
      })

      await promise
      callback.flush()
      taskItem.setCompleted(aborted ? 'aborted' : 'success')
    } catch (err) {
      if (err instanceof CanceledError) {
        taskItem.setCompleted('aborted')
        return
      }

      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: taskItem.getUserId(),
          err,
        },
        'Error fixing SQL block with AI'
      )
      taskItem.setCompleted('error')
    } finally {
      cleanup()
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new AISQLExecutor(doc.workspaceId, doc.documentId, doc.blocks, {
      editWithAI,
    })
  }
}
