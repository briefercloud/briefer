import * as Y from 'yjs'
import { ExecutionQueueItem, YExecutionQueueItem } from './item.js'

export type YExecutionQueueBatchAttrs = {
  version: 1
  queue: Y.Array<YExecutionQueueItem>
  isRunAll: boolean
}

export type YExecutionQueueBatch = Y.XmlElement<YExecutionQueueBatchAttrs>

export function createYExecutionQueueBatch(
  items: YExecutionQueueItem[],
  { isRunAll }: { isRunAll: boolean }
): YExecutionQueueBatch {
  const queue = new Y.Array<YExecutionQueueItem>()
  queue.insert(0, items)

  const attrs: YExecutionQueueBatchAttrs = {
    version: 1,
    queue,
    isRunAll,
  }
  const el = new Y.XmlElement<YExecutionQueueBatchAttrs>()

  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return el
}

export class ExecutionQueueBatch {
  private constructor(private readonly batch: YExecutionQueueBatch) {}

  public isRunAll(): boolean {
    return this.batch.getAttribute('isRunAll') ?? false
  }

  public getCurrent(): ExecutionQueueItem | null {
    for (const raw of this.batch.getAttribute('queue') ?? new Y.Array()) {
      const item = ExecutionQueueItem.fromYjs(raw)
      if (!item.isComplete()) {
        return item
      }
    }

    return null
  }

  public *[Symbol.iterator](): Iterator<ExecutionQueueItem> {
    const yQueue = this.batch.getAttribute('queue') ?? new Y.Array()
    for (const raw of yQueue) {
      yield ExecutionQueueItem.fromYjs(raw)
    }
  }

  public toJSON() {
    return {
      version: 1,
      queue: (this.batch.getAttribute('queue') ?? new Y.Array()).map((raw) =>
        ExecutionQueueItem.fromYjs(raw)
      ),
      isRunAll: this.batch.getAttribute('isRunAll') ?? false,
    }
  }

  public static fromYjs(doc: YExecutionQueueBatch): ExecutionQueueBatch {
    return new ExecutionQueueBatch(doc)
  }
}
