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
    const batch = createYExecutionQueueBatch([item], { isRunAll: false })
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

    const batch = createYExecutionQueueBatch(items, { isRunAll: false })
    this.queue.push([batch])
  }

  public getBlockExecutions(
    blockId: string,
    tag?: ExecutionQueueItemMetadataWithoutNoop['_tag']
  ): Execution[] {
    debugger
    const executions: Execution[] = []
    for (const yBatch of this.queue) {
      const batch = ExecutionQueueBatch.fromYjs(yBatch)
      for (const item of batch) {
        console.log(item.getBlockId(), blockId, tag === undefined)
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

  private onObservation = () => {
    for (const observer of this.observers) {
      observer()
    }
  }

  public static fromYjs(doc: Y.Doc): ExecutionQueue {
    return new ExecutionQueue(doc)
  }
}
