import {
  DropdownInputBlock,
  YBlock,
  getDropdownInputAttributes,
  updateDropdownInputValue,
  updateDropdownInputVariable,
} from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import { logger } from '../../../../logger.js'
import {
  IDropdownInputExecutor,
  DropdownInputExecutor,
} from '../../executors_/blocks/dropdown-input.js'

export interface IDropdownInputObserver
  extends IBlockObserver<DropdownInputBlock> {}

export class DropdownInputObserver implements IDropdownInputObserver {
  private workspaceId: string
  private documentId: string
  private blocks: Y.Map<YBlock>
  private executor: IDropdownInputExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executor: IDropdownInputExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState(block: Y.XmlElement<DropdownInputBlock>) {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handling initial dropdown input block state'
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
    block: Y.XmlElement<DropdownInputBlock>,
    action: string,
    oldValue: any,
    key: string
  ) {
    if (action !== 'update') {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
        },
        'Ignoring dropdown input block event'
      )
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        action,
        key,
      },
      'Handling dropdown input block event'
    )

    if (key === 'value') {
      await this.handleBlockValueChange(block, oldValue)
    } else if (key === 'variable') {
      await this.handleBlockVariableChange(block, oldValue)
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handled dropdown input block event'
    )
  }

  private async handleBlockValueChange(
    block: Y.XmlElement<DropdownInputBlock>,
    oldValue: DropdownInputBlock['value']
  ) {
    const attrs = getDropdownInputAttributes(block, this.blocks)
    if (attrs.value.status === 'idle') {
      return
    }

    if (attrs.value.status === oldValue.status) {
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.value.status,
      },
      'Handling dropdown input block value status'
    )

    if (attrs.value.status === 'save-requested') {
      updateDropdownInputValue(block, { status: 'saving' })
    } else if (attrs.value.status === 'saving') {
      await this.saveDropdownInputValue(block)
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        status: attrs.value.status,
      },
      'Handled dropdown input block value status'
    )
  }

  private async saveDropdownInputVariable(
    block: Y.XmlElement<DropdownInputBlock>
  ) {
    try {
      await this.executor.saveVariable(block)
      updateDropdownInputVariable(block, this.blocks, {
        status: 'idle',
      })
    } catch (error) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          error,
        },
        'Failed to save variable value'
      )
      updateDropdownInputVariable(block, this.blocks, {
        status: 'idle',
        error: 'unexpected-error',
      })
    }
  }

  private async handleBlockVariableChange(
    block: Y.XmlElement<DropdownInputBlock>,
    oldValue: DropdownInputBlock['variable']
  ) {
    const attrs = getDropdownInputAttributes(block, this.blocks)
    if (attrs.variable.status === 'idle') {
      return
    }

    if (attrs.variable.status === oldValue.status) {
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: attrs.id,
        status: attrs.variable.status,
      },
      'Handling dropdown input block variable status'
    )

    if (attrs.variable.status === 'save-requested') {
      updateDropdownInputVariable(block, this.blocks, { status: 'saving' })
    } else if (attrs.variable.status === 'saving') {
      await this.saveDropdownInputVariable(block)
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        status: attrs.variable.status,
      },
      'Handled dropdown input block variable status'
    )
  }

  private async saveDropdownInputValue(
    block: Y.XmlElement<DropdownInputBlock>
  ) {
    try {
      await this.executor.saveValue(block)
      updateDropdownInputValue(block, { status: 'idle' })
    } catch (error) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          error,
        },
        'Failed to save dropdown input value'
      )
      updateDropdownInputValue(block, {
        status: 'idle',
        error: 'unexpected-error',
      })
    }
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    const executor = DropdownInputExecutor.make(
      workspaceId,
      documentId,
      blocks,
      executionQueue
    )

    return new DropdownInputObserver(workspaceId, documentId, blocks, executor)
  }
}
