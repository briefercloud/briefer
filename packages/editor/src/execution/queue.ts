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
  YExecutionQueueItem,
} from './item.js'
import {
  getBaseAttributes,
  getBlocks,
  getLayout,
  getTabsFromBlockGroupId,
  switchBlockType,
  YBlock,
  YBlockGroup,
} from '../index.js'

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
    blockId: string | YBlock,
    userId: string | null,
    metadata: ExecutionQueueItemMetadataWithoutNoop
  ): void {
    const bId =
      typeof blockId === 'string' ? blockId : getBaseAttributes(blockId).id
    const item = createYExecutionQueueItem(bId, userId, metadata)
    const batch = createYExecutionQueueBatch([item], {
      isRunAll: false,
      isSchedule: false,
    })
    this.queue.push([batch])
  }

  public enqueueBlockGroup(
    yDoc: Y.Doc,
    blockGroupId: string,
    userId: string | null
  ): void {
    const blocks = getBlocks(yDoc)
    const tabs = getTabsFromBlockGroupId(getLayout(yDoc), blocks, blockGroupId)
    const items: YExecutionQueueItem[] = []
    for (const tab of tabs) {
      const block = blocks.get(tab.blockId)
      if (!block) {
        continue
      }

      const metadata =
        switchBlockType<ExecutionQueueItemMetadataWithoutNoop | null>(block, {
          onSQL: () => ({
            _tag: 'sql',
            isSuggestion: false,
            selectedCode: null,
          }),
          onPython: () => ({ _tag: 'python', isSuggestion: false }),
          onVisualization: () => ({ _tag: 'visualization' }),
          // TODO
          onInput: () => null,
          // TODO
          onDateInput: () => null,
          // TODO
          onDropdownInput: () => null,
          // TODO
          onWriteback: () => null,
          // TODO
          onPivotTable: () => null,
          onFileUpload: () => null,
          onRichText: () => null,
          onDashboardHeader: () => null,
        })

      if (!metadata) {
        continue
      }

      items.push(createYExecutionQueueItem(tab.blockId, userId, metadata))
    }

    const batch = createYExecutionQueueBatch(items, {
      isRunAll: false,
      isSchedule: false,
    })
    this.queue.push([batch])
  }

  public enqueueRunAll(
    layout: Y.Array<YBlockGroup>,
    blocks: Y.Map<YBlock>,
    source: { userId: string | null } | 'schedule'
  ): ExecutionQueueBatch {
    const items: YExecutionQueueItem[] = []
    const userId = typeof source === 'string' ? null : source.userId

    layout.forEach((group) => {
      const tabs = group.getAttribute('tabs')
      if (!tabs) {
        return
      }

      tabs.forEach((tab) => {
        const blockId = tab.getAttribute('id')
        if (!blockId) {
          return
        }

        const block = blocks.get(blockId)
        if (!block) {
          return
        }

        const item = switchBlockType(block, {
          onSQL: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'sql',
              isSuggestion: false,
              selectedCode: null,
            })
          },
          onPython: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'python',
              isSuggestion: false,
            })
          },
          onVisualization: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'visualization',
            })
          },
          onInput: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'text-input-save-value',
            })
          },
          onDateInput: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'date-input',
            })
          },
          onDropdownInput: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'dropdown-input-save-value',
            })
          },
          onWriteback: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'writeback',
            })
          },
          onPivotTable: () => {
            return createYExecutionQueueItem(blockId, userId, {
              _tag: 'pivot-table',
            })
          },
          onFileUpload: () => {
            return null
          },
          onRichText: () => {
            return null
          },
          onDashboardHeader: () => {
            return null
          },
        })

        if (item) {
          items.push(item)
        }
      })
    })

    const batch = createYExecutionQueueBatch(items, {
      isRunAll: true,
      isSchedule: source === 'schedule',
    })
    this.queue.push([batch])
    return ExecutionQueueBatch.fromYjs(batch)
  }

  public getBlockExecutions(
    blockId: string,
    tag?: ExecutionQueueItemMetadataWithoutNoop['_tag']
  ): Execution[] {
    const executions: Execution[] = []
    for (const yBatch of this.queue) {
      const batch = ExecutionQueueBatch.fromYjs(yBatch)
      for (const item of batch) {
        if (
          item.getBlockId() === blockId &&
          (tag === undefined || item.getMetadata()._tag === tag)
        ) {
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

  public getRunAllBatches(): ExecutionQueueBatch[] {
    return this.queue
      .toArray()
      .filter((batch) => batch.getAttribute('isRunAll'))
      .map((batch) => ExecutionQueueBatch.fromYjs(batch))
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
