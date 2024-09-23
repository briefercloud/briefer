import {
  DropdownInputBlock,
  YBlock,
  getDropdownInputAttributes,
  updateDropdownInputValue,
  updateDropdownInputVariable,
  updateDropdownInputBlockExecutedAt,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../../logger.js'
import { setVariable } from '../../../../python/input.js'

export type DropdownInputEffects = {
  setVariable: typeof setVariable
}

export interface IDropdownInputExecutor {
  isIdle(): boolean
  saveVariable(block: Y.XmlElement<DropdownInputBlock>): Promise<void>
  saveValue(block: Y.XmlElement<DropdownInputBlock>): Promise<void>
  abortSaveValue(block: Y.XmlElement<DropdownInputBlock>): Promise<void>
}

type Running = {
  abortController: AbortController
  abort?: () => Promise<void>
}

export class DropdownInputExecutor implements IDropdownInputExecutor {
  private workspaceId: string
  private documentId: string
  private executionQueue: PQueue
  private blocks: Y.Map<YBlock>
  private effects: DropdownInputEffects
  private running: Map<Y.XmlElement<DropdownInputBlock>, Running> = new Map()

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    effects: DropdownInputEffects = {
      setVariable,
    }
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.executionQueue = executionQueue
    this.effects = effects
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async saveVariable(block: Y.XmlElement<DropdownInputBlock>) {
    const attrs = getDropdownInputAttributes(block, this.blocks)

    const { newValue: newVariableName } = attrs.variable
    const { value } = attrs.value

    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(newVariableName)) {
      updateDropdownInputVariable(block, this.blocks, {
        error: 'invalid-variable-name',
      })
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        variableName: newVariableName,
      },
      'Adding dropdown input variable to execution queue'
    )

    const running: Running = { abortController: new AbortController() }
    this.running.set(block, running)
    try {
      await this.executionQueue.add(
        async ({ signal }) => {
          logger().trace(
            {
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
            return
          }

          const { promise, abort } = await this.effects.setVariable(
            this.workspaceId,
            this.documentId,
            newVariableName,
            value
          )

          if (!signal?.aborted) {
            await promise
            updateDropdownInputVariable(block, this.blocks, {
              value: newVariableName,
              error: null,
            })
            logger().trace(
              {
                workspaceId: this.workspaceId,
                documentId: this.documentId,
                blockId: attrs.id,
                variableName: newVariableName,
              },
              'Saved dropdown input variable'
            )
          } else {
            await abort()
          }
        },
        { signal: running.abortController.signal }
      )
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') {
        return
      }

      throw e
    }
  }

  public async saveValue(block: Y.XmlElement<DropdownInputBlock>) {
    const attrs = getDropdownInputAttributes(block, this.blocks)

    const { value: variableName } = attrs.variable
    const { newValue } = attrs.value

    if (newValue === null) {
      updateDropdownInputValue(block, {
        error: 'invalid-value',
      })
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        variableName,
        newValue,
      },
      'Adding dropdown input value to execution queue'
    )

    await this.executionQueue.add(async () => {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          variableName,
          newValue,
        },
        'Saving dropdown input value'
      )

      await this.effects
        .setVariable(this.workspaceId, this.documentId, variableName, newValue)
        .then(({ promise }) => promise)
      updateDropdownInputValue(block, {
        value: newValue,
        error: null,
      })
      updateDropdownInputBlockExecutedAt(block, new Date())
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: attrs.id,
          variableName,
          newValue,
        },
        'Saved dropdown input value'
      )
    })
  }

  public async abortSaveValue(block: Y.XmlElement<DropdownInputBlock>) {
    const running = this.running.get(block)
    if (!running) {
      return
    }

    running.abortController.abort()
    await running.abort?.()
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    return new DropdownInputExecutor(
      workspaceId,
      documentId,
      blocks,
      executionQueue,
      {
        setVariable,
      }
    )
  }
}
