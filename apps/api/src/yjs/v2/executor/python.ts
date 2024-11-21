import * as Y from 'yjs'
import {
  ExecutionQueueItem,
  getPythonAttributes,
  PythonBlock,
  YBlock,
} from '@briefer/editor'
import { executeCode as executePython } from '../../../python/index.js'
import { logger } from '../../../logger.js'
import { ExecutionQueueItemPythonMetadata } from '@briefer/editor/types/execution/item.js'
import { listDataFrames } from '../../../python/query/index.js'
import { updateDataframes } from './index.js'
import { DataFrame } from '@briefer/types'
import { PythonEvents } from '../../../events/index.js'
import { WSSharedDocV2 } from '../index.js'

export type PythonEffects = {
  executePython: typeof executePython
  listDataFrames: typeof listDataFrames
}

export interface IPythonExecutor {
  run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PythonBlock>,
    metadata: ExecutionQueueItemPythonMetadata,
    events: PythonEvents
  ): Promise<void>
}

export class PythonExecutor implements IPythonExecutor {
  constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
    private dataframes: Y.Map<DataFrame>,
    private readonly blocks: Y.Map<YBlock>,
    private readonly effects: PythonEffects
  ) {}

  public async run(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<PythonBlock>,
    metadata: ExecutionQueueItemPythonMetadata,
    events: PythonEvents
  ): Promise<void> {
    events.pythonRun()
    block.setAttribute('result', [])

    try {
      block.setAttribute('startQueryTime', new Date().toISOString())

      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'executing python block'
      )

      const { aiSuggestions, source, id: blockId } = getPythonAttributes(block)

      const actualSource =
        (metadata.isSuggestion ? aiSuggestions : source)?.toJSON() ?? ''

      let errored = false
      const { promise, abort } = await this.effects.executePython(
        this.workspaceId,
        this.documentId,
        actualSource,
        (outputs) => {
          const prevOutputs = block.getAttribute('result') ?? []
          block.setAttribute('result', prevOutputs.concat(outputs))
          if (!errored) {
            for (const output of outputs) {
              if (output.type === 'error') {
                errored = true
                break
              }
            }
          }
        },
        { storeHistory: true }
      )
      let abortP = Promise.resolve(false)
      const cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          abortP = abort().then(() => true)
        }
      })
      await promise
      const aborted = await abortP
      if (aborted) {
        executionItem.setCompleted('aborted')
        cleanup()
        return
      }

      await this.updateDataFrames(blockId)

      block.setAttribute('lastQuery', block.getAttribute('source')!.toJSON())
      block.setAttribute('lastQueryTime', new Date().toISOString())
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
        },
        'python block executed'
      )
      executionItem.setCompleted(errored ? 'error' : 'success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          err,
        },
        'Error while executing python block'
      )
      executionItem.setCompleted('error')
    }
  }

  private async updateDataFrames(blockId: string) {
    const newDataframes = await this.effects.listDataFrames(
      this.workspaceId,
      this.documentId
    )

    const blocks = new Set(Array.from(this.blocks.keys()))

    updateDataframes(this.dataframes, newDataframes, blockId, blocks)
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new PythonExecutor(
      doc.workspaceId,
      doc.documentId,
      doc.dataframes,
      doc.blocks,
      {
        executePython,
        listDataFrames,
      }
    )
  }
}