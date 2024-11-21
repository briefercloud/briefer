import debounce from 'lodash.debounce'
import * as Y from 'yjs'
import { getWorkspaceWithSecrets } from '@briefer/database'
import { DataFrame, PythonErrorOutput } from '@briefer/types'
import { pythonEditStreamed } from '../../../../ai-api.js'
import {
  AITaskItem,
  AITaskItemEditPythonMetadata,
  AITaskItemFixPythonMetadata,
  closePythonEditWithAIPrompt,
  getPythonBlockEditWithAIPrompt,
  getPythonBlockResult,
  getPythonSource,
  PythonBlock,
  updatePythonAISuggestions,
} from '@briefer/editor'
import { WSSharedDocV2 } from '../../index.js'
import { AIEvents } from '../../../../events/index.js'
import { logger } from '../../../../logger.js'

async function editWithAI(
  workspaceId: string,
  source: string,
  instructions: string,
  dataFrames: DataFrame[],
  event: (modelId: string | null) => void,
  onSource: (source: string) => void
) {
  const workspace = workspaceId
    ? await getWorkspaceWithSecrets(workspaceId)
    : null

  event(workspace?.assistantModel ?? null)

  await pythonEditStreamed(
    source,
    instructions,
    dataFrames,
    onSource,
    workspace?.assistantModel ?? null,
    workspace?.secrets?.openAiApiKey ?? null
  )
}

export interface IPythonAIExecutor {
  editWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<PythonBlock>,
    metadata: AITaskItemEditPythonMetadata,
    events: AIEvents
  ): Promise<void>
  fixWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<PythonBlock>,
    metadata: AITaskItemFixPythonMetadata,
    events: AIEvents
  ): Promise<void>
}

export class AIPythonExecutor implements IPythonAIExecutor {
  constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly dataframes: Y.Map<DataFrame>,
    private readonly effects: { editWithAI: typeof editWithAI }
  ) {}

  public async editWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<PythonBlock>,
    _metadata: AITaskItemEditPythonMetadata,
    events: AIEvents
  ): Promise<void> {
    try {
      const instructions = getPythonBlockEditWithAIPrompt(block).toJSON()
      if (!instructions) {
        taskItem.setCompleted('error')
        return
      }

      const source = getPythonSource(block).toJSON()
      await this.effects.editWithAI(
        this.workspaceId,
        source,
        instructions,
        Array.from(this.dataframes.values()),
        (modelId) => {
          events.aiUsage('python', 'edit', modelId)
        },
        debounce((suggestions) => {
          updatePythonAISuggestions(block, suggestions)
        }, 50)
      )
      closePythonEditWithAIPrompt(block, true)
      taskItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: taskItem.getUserId(),
          err,
        },
        'Error editing python block with AI'
      )
      taskItem.setCompleted('error')
    }
  }

  public async fixWithAI(
    taskItem: AITaskItem,
    block: Y.XmlElement<PythonBlock>,
    _metadata: AITaskItemFixPythonMetadata,
    events: AIEvents
  ): Promise<void> {
    try {
      const error = getPythonBlockResult(block).find(
        (r): r is PythonErrorOutput => r.type === 'error'
      )
      if (!error) {
        taskItem.setCompleted('error')
        return
      }

      const instructions = `Fix the Python code, this is the error: ${JSON.stringify(
        {
          ...error,
          traceback: error.traceback.slice(0, 2),
        }
      )}`
      const source = getPythonSource(block).toJSON()

      await this.effects.editWithAI(
        this.workspaceId,
        source,
        instructions,
        Array.from(this.dataframes.values()),
        (modelId) => {
          events.aiUsage('python', 'fix', modelId)
        },
        debounce((suggestions) => {
          updatePythonAISuggestions(block, suggestions)
        }, 50)
      )
      taskItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: taskItem.getUserId(),
          err,
        },
        'Error fixing python block with AI'
      )
      taskItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2): AIPythonExecutor {
    return new AIPythonExecutor(
      doc.workspaceId,
      doc.documentId,
      doc.dataframes,
      { editWithAI }
    )
  }
}
