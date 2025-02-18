import * as Y from 'yjs'
import {
  ExecutionQueueItem,
  ExecutionStatus,
  YExecutionQueueItem,
} from './item.js'
import { exhaustiveCheck } from '../utils.js'

export type YExecutionQueueBatchAttrs = {
  version: 1
  queue: Y.Array<YExecutionQueueItem>
  isRunAll: boolean
  scheduleId: string | null
}

export type YExecutionQueueBatch = Y.XmlElement<YExecutionQueueBatchAttrs>

export function createYExecutionQueueBatch(
  items: YExecutionQueueItem[],
  { isRunAll, scheduleId }: { isRunAll: boolean; scheduleId: string | null }
): YExecutionQueueBatch {
  const queue = new Y.Array<YExecutionQueueItem>()
  queue.insert(0, items)

  const attrs: YExecutionQueueBatchAttrs = {
    version: 1,
    queue,
    isRunAll,
    scheduleId,
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

  public getScheduleId(): string | null {
    return this.batch.getAttribute('scheduleId') ?? null
  }

  public getCurrent(): ExecutionQueueItem | null {
    const queue = this.batch.getAttribute('queue')
    if (!queue) {
      return null
    }

    for (const raw of queue) {
      const item = ExecutionQueueItem.fromYjs(raw)
      if (item.getCompleteStatus() === null) {
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

  public abort() {
    for (const item of this) {
      if (item.getStatus()._tag !== 'completed') {
        item.setAborting()
      }
    }
  }

  public waitForCompletion(): Promise<string | null> {
    return new Promise((resolve) => {
      let current = this.getCurrent()
      let interval: NodeJS.Timeout | null = null
      const onObservation = () => {
        if (!current) {
          this.batch.unobserveDeep(onObservation)
          if (interval) {
            clearInterval(interval)
          }

          resolve(null)
          return
        }

        if (current.getCompleteStatus() === 'error') {
          this.batch.unobserveDeep(onObservation)
          if (interval) {
            clearInterval(interval)
          }

          resolve(current.getBlockId())
          return
        }

        current = this.getCurrent()
        if (!current) {
          this.batch.unobserveDeep(onObservation)
          if (interval) {
            clearInterval(interval)
          }

          resolve(null)
          return
        }
      }
      this.batch.observeDeep(onObservation)

      // safe guard, this makes sure we don't wait forever
      // because we missed an observation
      interval = setInterval(onObservation, 5000)
    })
  }

  public get length(): number {
    return this.batch.getAttribute('queue')?.length ?? 0
  }

  public get remaining(): number {
    let currentPos = 0
    for (const item of this) {
      if (item.getCompleteStatus() !== null) {
        currentPos++
      } else {
        break
      }
    }

    return this.length - currentPos
  }

  public get status(): ExecutionStatus {
    let status: ExecutionStatus = 'unknown'
    for (const item of this) {
      const itemStatus = item.getStatus()._tag
      switch (itemStatus) {
        case 'completed':
          status = 'completed'
          break
        case 'running':
        case 'unknown':
        case 'aborting':
        case 'enqueued':
          return itemStatus
        default:
          exhaustiveCheck(itemStatus)
      }
    }

    return status
  }

  public removeItem(blockId: string) {
    const queue = this.batch.getAttribute('queue')
    if (!queue) {
      return
    }

    let index = -1
    for (let i = 0; i < queue.length; i++) {
      if (queue.get(i)?.getAttribute('blockId') === blockId) {
        index = i
        break
      }
    }

    if (index !== -1) {
      queue.delete(index)
    }
  }

  public static fromYjs(doc: YExecutionQueueBatch): ExecutionQueueBatch {
    return new ExecutionQueueBatch(doc)
  }
}
