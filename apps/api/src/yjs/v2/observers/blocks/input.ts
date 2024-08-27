import {
  InputBlock,
  YBlock,
  getInputAttributes,
  updateInputValue,
  updateInputVariable,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import { setVariable } from '../../../../python/input.js'
import { IInputExecutor, InputExecutor } from '../../executors/blocks/input.js'

export type InputEffects = {
  setVariable: typeof setVariable
}

export interface IInputObserver extends IBlockObserver<InputBlock> {}

export class InputObserver implements IInputObserver {
  private workspaceId: string
  private documentId: string
  private blocks: Y.Map<YBlock>
  private executor: IInputExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executor: IInputExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<InputBlock>) {
    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handling initial input block state'
    )

    const value = block.getAttribute('value')
    if (value && value.status !== 'idle') {
      block.setAttribute('value', {
        ...value,
        status: 'idle',
      })
    }

    const variable = block.getAttribute('variable')
    if (variable && variable.status !== 'idle') {
      block.setAttribute('variable', {
        ...variable,
        status: 'idle',
      })
    }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<InputBlock>,
    action: string,
    oldValue: any,
    key: string
  ) {
    if (action !== 'update') {
      logger.trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
        },
        'Ignoring input block event'
      )
      return
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        action,
        key,
      },
      'Handling input block event'
    )

    if (key === 'value') {
      await this.handleBlockValueChange(block, oldValue)
    } else if (key === 'variable') {
      await this.handleBlockVariableChange(block, oldValue)
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handled input block event'
    )
  }

  private async handleBlockValueChange(
    block: Y.XmlElement<InputBlock>,
    oldValue: InputBlock['value']
  ) {
    const attrs = getInputAttributes(block, this.blocks)
    if (attrs.value.status === 'idle') {
      return
    }

    if (attrs.value.status === oldValue.status) {
      return
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.value.status,
      },
      'Handling input block value status'
    )

    if (attrs.value.status === 'save-requested') {
      updateInputValue(block, { status: 'saving' })
    } else if (attrs.value.status === 'saving') {
      await this.saveInputValue(block)
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        status: attrs.value.status,
      },
      'Handled input block value status'
    )
  }

  private async saveInputVariable(block: Y.XmlElement<InputBlock>) {
    try {
      await this.executor.saveVariable(block)
      updateInputVariable(block, this.blocks, {
        status: 'idle',
      })
    } catch (error) {
      logger.error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          error,
        },
        'Failed to save variable value'
      )
      updateInputVariable(block, this.blocks, {
        status: 'idle',
        error: 'unexpected-error',
      })
    }
  }

  private async handleBlockVariableChange(
    block: Y.XmlElement<InputBlock>,
    oldValue: InputBlock['variable']
  ) {
    const attrs = getInputAttributes(block, this.blocks)
    if (attrs.variable.status === 'idle') {
      return
    }

    if (attrs.variable.status === oldValue.status) {
      return
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.variable.status,
      },
      'Handling input block variable status'
    )

    if (attrs.variable.status === 'save-requested') {
      updateInputVariable(block, this.blocks, { status: 'saving' })
    } else if (attrs.variable.status === 'saving') {
      await this.saveInputVariable(block)
    }

    logger.trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        status: attrs.variable.status,
      },
      'Handled input block variable status'
    )
  }

  private async saveInputValue(block: Y.XmlElement<InputBlock>) {
    try {
      await this.executor.saveValue(block)
      updateInputValue(block, { status: 'idle', error: null })
    } catch (error) {
      logger.error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          error,
        },
        'Failed to save input value'
      )
      updateInputValue(block, { status: 'idle', error: 'unexpected-error' })
    }
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    const executor = InputExecutor.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )

    return new InputObserver(workspaceId, documentId, blocks, executor)
  }
}
