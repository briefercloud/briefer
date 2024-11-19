import {
  DateInputBlock,
  ExecutionQueueItem,
  ExecutionQueueItemDateInputMetadata,
  YBlock,
  getDateInputAttributes,
} from '@briefer/editor'
import * as Y from 'yjs'
import { logger } from '../../../logger.js'
import { setDateTimeVariable } from '../../../python/input.js'
import { WSSharedDocV2 } from '../index.js'

export type DateInputEffects = {
  setDateTimeVariable: typeof setDateTimeVariable
}

export interface IDateInputExecutor {
  save(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DateInputBlock>,
    metadata: ExecutionQueueItemDateInputMetadata
  ): Promise<void>
}

export class DateInputExecutor implements IDateInputExecutor {
  private workspaceId: string
  private documentId: string
  private blocks: Y.Map<YBlock>
  private effects: DateInputEffects

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    effects: DateInputEffects = {
      setDateTimeVariable,
    }
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.blocks = blocks
    this.effects = effects
  }

  public async save(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DateInputBlock>,
    _metadata: ExecutionQueueItemDateInputMetadata
  ) {
    const {
      id: blockId,
      variable,
      value,
    } = getDateInputAttributes(block, this.blocks)

    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(variable)) {
      block.setAttribute('error', 'invalid-variable')
      executionItem.setCompleted('error')
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId,
        variable,
        value,
      },
      'Saving date input variable'
    )

    try {
      await this.effects.setDateTimeVariable(
        this.workspaceId,
        this.documentId,
        variable,
        value
      )
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId,
          variable,
          value,
        },
        'Saved date input variable'
      )
      executionItem.setCompleted('success')
    } catch (err) {
      logger().error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId,
          variable,
          value,
          err,
        },
        'Failed to save date input variable'
      )
      block.setAttribute('error', 'unexpected-error')
      executionItem.setCompleted('error')
    }
  }

  public static fromWSSharedDocV2(doc: WSSharedDocV2) {
    return new DateInputExecutor(doc.workspaceId, doc.documentId, doc.blocks, {
      setDateTimeVariable,
    })
  }
}
