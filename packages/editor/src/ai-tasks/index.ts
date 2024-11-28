import * as Y from 'yjs'
import {
  AITaskItem,
  AITaskItemMetadataWithoutNoop,
  createYAITaskItem,
  YAITaskItem,
} from './item.js'
import { exhaustiveCheck } from '../utils.js'

export * from './item.js'

export type YAITasks = Y.Array<YAITaskItem>

export const AI_TASK_PING_TIMEOUT = 1000 * 5 // 5 seconds

export class AITasks {
  private readonly observers: Set<() => void> = new Set()
  private constructor(private readonly tasks: YAITasks) {}

  public enqueue(
    blockId: string,
    userId: string | null,
    metadata: AITaskItemMetadataWithoutNoop
  ): void {
    const item = createYAITaskItem(blockId, userId, metadata)
    this.tasks.push([item])
  }

  public next(): AITaskItem | null {
    let pos = 0
    let current = this.tasks.get(pos)
    while (current) {
      const item = AITaskItem.fromYjs(current)
      const status = item.getStatus()
      switch (status._tag) {
        case 'unknown':
        case 'enqueued':
          item.setRunning()
          return item
        case 'running':
          if (Date.now() - status.ping > AI_TASK_PING_TIMEOUT) {
            item.ping()
            return item
          }
          pos++
          break
        case 'aborting':
        case 'completed':
          this.tasks.delete(pos)
          break
        default:
          exhaustiveCheck(status)
      }

      current = this.tasks.get(pos)
    }

    return null
  }

  public getBlockTasks(
    blockId: string,
    tag?: AITaskItemMetadataWithoutNoop['_tag']
  ): AITaskItem[] {
    const tasks: AITaskItem[] = []
    for (const yItem of this.tasks) {
      const item = AITaskItem.fromYjs(yItem)
      if (item.getBlockId() === blockId) {
        if (tag && item.getMetadata()._tag !== tag) {
          continue
        }
        tasks.push(item)
      }
    }

    return tasks
  }

  public observe(cb: () => void): () => void {
    this.observers.add(cb)
    if (this.observers.size === 1) {
      this.tasks.observeDeep(this.onObservation)
    }

    return () => {
      this.observers.delete(cb)
      if (this.observers.size === 0) {
        this.tasks.unobserveDeep(this.onObservation)
      }
    }
  }

  private onObservation = () => {
    for (const observer of this.observers) {
      observer()
    }
  }

  public size(): number {
    return this.tasks.length
  }

  public static fromYjs(doc: Y.Doc): AITasks {
    return new AITasks(doc.getArray<YAITaskItem>('aiTasks'))
  }
}
