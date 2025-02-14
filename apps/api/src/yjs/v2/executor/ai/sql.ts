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
import prisma, {
  listDataSources,
  getWorkspaceWithSecrets,
  DataSource,
  decrypt,
} from '@briefer/database'
import { logger } from '../../../../logger.js'
import { sqlEditStreamed } from '../../../../ai-api.js'
import { AIEvents } from '../../../../events/index.js'
import { WSSharedDocV2 } from '../../index.js'
import { CanceledError } from 'axios'
import {
  fetchDataSourceStructureFromCache,
  listSchemaTables,
} from '../../../../datasources/structure.js'
import { DataSourceStructureStateV3, uuidSchema } from '@briefer/types'
import { createEmbedding } from '../../../../embedding.js'
import { config } from '../../../../config/index.js'
import { z } from 'zod'

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
      source,
      instructions,
      'DuckDB',
      onSuggestions,
      // TODO: what should be the schema when duckdb?
      null,
      assistantModelId,
      workspace?.secrets?.openAiApiKey ?? null
    )
  }

  const dataSources = await listDataSources(workspaceId)
  const dataSource = dataSources.find((ds) => ds.data.id === datasourceId.id)
  if (!dataSource) {
    throw new Error(`Datasource with id ${datasourceId} not found`)
  }

  const structure = await fetchDataSourceStructureFromCache(
    dataSource.data.id,
    dataSource.type
  )

  let openAiApiKey = workspace?.secrets?.openAiApiKey ?? null
  if (openAiApiKey) {
    openAiApiKey = decrypt(
      openAiApiKey,
      config().WORKSPACE_SECRETS_ENCRYPTION_KEY
    )
  } else {
    openAiApiKey = config().OPENAI_API_KEY
  }

  const tableInfo = await retrieveTableInfoForQuestion(
    dataSource,
    structure,
    instructions,
    openAiApiKey
  )

  event(assistantModelId)

  const dialect: string = (() => {
    switch (dataSource.type) {
      case 'psql':
        return 'postgresql'
      case 'redshift':
        return 'redshift'
      case 'trino':
        return 'trino'
      case 'bigquery':
        return 'bigquery'
      case 'athena':
        return 'awsathena'
      case 'oracle':
        return 'oracle'
      case 'mysql':
        return 'mysql'
      case 'sqlserver':
        return 'mssql'
      case 'snowflake':
        return 'snowflake'
      case 'databrickssql':
        return 'databricks'
    }
  })()

  return sqlEditStreamed(
    source,
    instructions,
    dialect,
    onSuggestions,
    tableInfo,
    assistantModelId,
    workspace?.secrets?.openAiApiKey ?? null
  )
}

async function retrieveTableInfoForQuestion(
  datasource: DataSource,
  structure: DataSourceStructureStateV3 | null,
  question: string,
  openAiApiKey: string | null
): Promise<string | null> {
  if (!structure) {
    return null
  }

  const questionEmbeddingResult = await createEmbedding(question, openAiApiKey)
  let tableInfo: string
  if (questionEmbeddingResult) {
    const raw = await prisma()
      .$queryRaw`SELECT t.id, t.embedding <=> ${questionEmbeddingResult.embedding}::vector AS distance FROM "DataSourceSchemaTable" t INNER JOIN "DataSourceSchema" s ON s.id = t."dataSourceSchemaId" WHERE s.id = ${structure.id}::uuid AND t."embeddingModel" = ${questionEmbeddingResult.model} ORDER BY distance LIMIT 30`

    const result = z.array(z.object({ id: uuidSchema })).parse(raw)

    const tables = await prisma().dataSourceSchemaTable.findMany({
      where: {
        id: { in: result.map((r) => r.id) },
      },
    })

    tableInfo = ''
    for (const table of tables) {
      tableInfo += `${table.schema}.${table.name}\n`
      const columns = z
        .array(z.object({ name: z.string(), type: z.string() }))
        .parse(table.columns)
      for (const column of columns) {
        tableInfo += `${column.name} ${column.type}\n`
      }
      tableInfo += '\n'
    }
  } else {
    tableInfo = await tableInfoFromStructure(datasource, structure)
  }

  const schema = await prisma().dataSourceSchema.findUnique({
    where: { id: structure.id },
    select: { additionalInfo: true },
  })
  if (schema?.additionalInfo) {
    const additionalInfo = schema.additionalInfo.trim()
    if (additionalInfo !== '') {
      tableInfo += `\nAdditional information:\n${schema.additionalInfo}`
    }
  }

  return tableInfo.trim()
}

async function tableInfoFromStructure(
  config: DataSource,
  structure: DataSourceStructureStateV3
): Promise<string> {
  let result = ''
  for await (const schemaTable of listSchemaTables([{ config, structure }])) {
    result += `${schemaTable.schemaName}.${schemaTable.tableName}\n`
    for (const column of schemaTable.table.columns) {
      result += `${column.name} ${column.type}\n`
    }
    result += '\n'
  }

  return result.trim()
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
