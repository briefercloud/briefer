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
  constructor(
    private readonly sessionId: string,
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly blocks: Y.Map<YBlock>,
    private readonly effects: DateInputEffects = {
      setDateTimeVariable,
    }
  ) {}

  public async save(
    executionItem: ExecutionQueueItem,
    block: Y.XmlElement<DateInputBlock>,
    _metadata: ExecutionQueueItemDateInputMetadata
  ) {
    const {
      id: blockId,
      variable,
      value,
      dateType,
    } = getDateInputAttributes(block, this.blocks)

    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(variable)) {
      block.setAttribute('error', 'invalid-variable')
      executionItem.setCompleted('error')
      return
    }

    logger().trace(
      {
        sessionId: this.sessionId,
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
        this.sessionId,
        variable,
        value,
        dateType
      )
      logger().trace(
        {
          sessionId: this.sessionId,
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
          sessionId: this.sessionId,
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
    return new DateInputExecutor(
      doc.id,
      doc.workspaceId,
      doc.documentId,
      doc.blocks,
      {
        setDateTimeVariable,
      }
    )
  }
}
