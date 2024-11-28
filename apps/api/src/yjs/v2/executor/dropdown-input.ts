import {
  DropdownInputBlock,
  YBlock,
  getDropdownInputAttributes,
  updateDropdownInputValue,
  updateDropdownInputVariable,
  updateDropdownInputBlockExecutedAt,
  ExecutionQueueItemDropdownInputRenameVariableMetadata,
  ExecutionQueueItem,
  ExecutionQueueItemDropdownInputSaveValueMetadata,
} from '@briefer/editor'
import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import { setVariable } from '../../../python/input.js'
import { WSSharedDocV2 } from '../index.js'

export type DropdownInputEffects = {
  setVariable: typeof setVariable
}

export interface IDropdownInputExecutor {
  saveValue(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DropdownInputBlock>,
    metadata: ExecutionQueueItemDropdownInputSaveValueMetadata
  ): Promise<void>
  renameVariable(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DropdownInputBlock>,
    metadata: ExecutionQueueItemDropdownInputRenameVariableMetadata
  ): Promise<void>
}

export class DropdownInputExecutor implements IDropdownInputExecutor {
  constructor(
    private readonly sessionId: string,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly blocks: Y.Map<YBlock>,
    private readonly effects: DropdownInputEffects = {
      setVariable,
    }
  ) {}

  public async renameVariable(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DropdownInputBlock>,
    _metadata: ExecutionQueueItemDropdownInputRenameVariableMetadata
  ) {
    const attrs = getDropdownInputAttributes(block, this.blocks)

    const { newValue: newVariableName } = attrs.variable
    const { value } = attrs.value

    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(newVariableName)) {
      updateDropdownInputVariable(block, this.blocks, {
        error: 'invalid-variable-name',
      })
      executionItem.setCompleted('error')
      return
    }

    try {
      logger().trace(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: attrs.id,
          variableName: newVariableName,
        },
        'Saving dropdown input variable'
      )

      if (value === null) {
        updateDropdownInputValue(block, {
          error: 'invalid-value',
        })
        executionItem.setCompleted('error')
        return
      }

      let aborted = false
      let cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          aborted = true
        }
      })

      const { promise, abort } = await this.effects.setVariable(
        this.workspaceId,
        this.sessionId,
        newVariableName,
        value
      )

      if (aborted) {
        await abort()
      }

      let abortP = Promise.resolve(aborted)
      cleanup()
      cleanup = executionItem.observeStatus((status) => {
        if (status._tag === 'aborting') {
          abortP = abort().then(() => true)
        }
      })

      await promise
      aborted = await abortP
      cleanup()

      if (!aborted) {
        updateDropdownInputVariable(block, this.blocks, {
          value: newVariableName,
          error: null,
        })
        logger().trace(
          {
            sessionId: this.sessionId,
            workspaceId: this.workspaceId,
            documentId: this.documentId,
            blockId: attrs.id,
            variableName: newVariableName,
          },
          'Saved dropdown input variable'
        )
      }
      executionItem.setCompleted(aborted ? 'aborted' : 'success')
    } catch (err) {
      logger().error(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: executionItem.getBlockId(),
          error: err,
        },
        'Failed to rename text input variable'
      )

      updateDropdownInputVariable(block, this.blocks, {
        error: 'unexpected-error',
      })
      executionItem.setCompleted('error')
    }
  }

  public async saveValue(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DropdownInputBlock>,
    _metadata: ExecutionQueueItemDropdownInputSaveValueMetadata
  ) {
    const attrs = getDropdownInputAttributes(block, this.blocks)

    const { value: variableName } = attrs.variable
    const { newValue } = attrs.value

    if (newValue === null) {
      updateDropdownInputValue(block, {
        error: 'invalid-value',
      })
      executionItem.setCompleted('error')
      return
    }

    try {
      logger().trace(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          variableName,
          newValue,
        },
        'Saving dropdown input value'
      )

      await this.effects
        .setVariable(this.workspaceId, this.sessionId, variableName, newValue)
        .then(({ promise }) => promise)
      updateDropdownInputValue(block, {
        value: newValue,
        error: null,
      })
      updateDropdownInputBlockExecutedAt(block, new Date())
      logger().trace(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: attrs.id,
          variableName,
          newValue,
        },
        'Saved dropdown input value'
      )
      executionItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          sessionId: this.sessionId,
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: executionItem.getBlockId(),
          error: err,
        },
        'Failed to save dropdown input value'
      )
      updateDropdownInputValue(block, {
        error: 'unexpected-error',
      })
      executionItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new DropdownInputExecutor(
      doc.id,
      doc.workspaceId,
      doc.documentId,
      doc.blocks,
      {
        setVariable,
      }
    )
  }
}
