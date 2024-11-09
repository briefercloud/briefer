import { DateInputBlock, YBlock, getDateInputAttributes } from '@briefer/editor'
import PQueue from 'p-queue'
import * as Y from 'yjs'
import { logger } from '../../../../logger.js'
import { setDateTimeVariable } from '../../../../python/input.js'

export type DateInputEffects = {
  setDateTimeVariable: typeof setDateTimeVariable
}

export interface IDateInputExecutor {
  isIdle(): boolean
  save(block: Y.XmlElement<DateInputBlock>): Promise<boolean>
}

export class DateInputExecutor implements IDateInputExecutor {
  private workspaceId: string
  private documentId: string
  private executionQueue: PQueue
  private blocks: Y.Map<YBlock>
  private effects: DateInputEffects

  constructor(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue,
    effects: DateInputEffects = {
      setDateTimeVariable,
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

  public async save(block: Y.XmlElement<DateInputBlock>) {
    const {
      id: blockId,
      variable,
      value,
    } = getDateInputAttributes(block, this.blocks)

    const dfNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!dfNameRegex.test(variable)) {
      block.setAttribute('status', 'invalid-variable')
      return false
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId,
        variable,
        value,
      },
      'Adding date input variable to execution queue'
    )

    const success = await this.executionQueue.add(async () => {
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
        return true
      } catch {
        block.setAttribute('status', 'unexpected-error')
        return false
      } finally {
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
      }
    })

    return success ?? false
  }

  public static make(
    workspaceId: string,
    documentId: string,
    blocks: Y.Map<YBlock>,
    executionQueue: PQueue
  ) {
    return new DateInputExecutor(
      workspaceId,
      documentId,
      blocks,
      executionQueue,
      {
        setDateTimeVariable,
      }
    )
  }
}
