import * as Y from 'yjs'
import {
  createYExecutionQueueBatch,
  ExecutionQueueBatch,
  YExecutionQueueBatch,
} from './batch.js'
import {
  createYExecutionQueueItem,
  ExecutionQueueItem,
  ExecutionQueueItemMetadataWithoutNoop,
} from './item.js'

export type YExecutionQueue = Y.Array<YExecutionQueueBatch>

export type Execution = {
  item: ExecutionQueueItem
  batch: ExecutionQueueBatch
}

export class ExecutionQueue {
  private queue: YExecutionQueue
  private observers: Set<() => void> = new Set()

  private constructor(doc: Y.Doc) {
    this.queue = doc.getArray<YExecutionQueueBatch>('executionQueue')
  }

  public getCurrentBatch(): ExecutionQueueBatch | null {
    const batch = this.queue.get(0)
    if (!batch) {
      return null
    }

    return ExecutionQueueBatch.fromYjs(batch)
  }

  public advance(): void {
    this.queue.delete(0)
  }

  public enqueueBlock(
    blockId: string,
    userId: string | null,
    metadata: ExecutionQueueItemMetadataWithoutNoop
  ): void {
    const item = createYExecutionQueueItem(blockId, userId, metadata)
    const batch = createYExecutionQueueBatch([item], { isRunAll: false })
    this.queue.push([batch])
  }

  public getBlockExecutions(blockId: string): Execution[] {
    const executions: Execution[] = []
    for (const yBatch of this.queue) {
      const batch = ExecutionQueueBatch.fromYjs(yBatch)
      for (const item of batch) {
        if (item.getBlockId() === blockId) {
          executions.push({ item, batch })
        }
      }
    }

    return executions
  }

  public observe(cb: () => void): () => void {
    this.observers.add(cb)
    if (this.observers.size === 1) {
      this.queue.observeDeep(this.onObservation)
    }

    return () => {
      this.observers.delete(cb)
      if (this.observers.size === 0) {
        this.queue.unobserveDeep(this.onObservation)
      }
    }
  }

  public toJSON(): ExecutionQueueBatch[] {
    return this.queue.map((batch) => ExecutionQueueBatch.fromYjs(batch))
  }

  private onObservation = () => {
    for (const observer of this.observers) {
      observer()
    }
  }

  public static fromYjs(doc: Y.Doc): ExecutionQueue {
    return new ExecutionQueue(doc)
  }
}
