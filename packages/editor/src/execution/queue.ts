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
  computeDepencyQueue,
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

export type ExecutionQueueOptions = {
  skipDependencyCheck: boolean
}

const defaultOptions: ExecutionQueueOptions = {
  skipDependencyCheck: false,
}

export class ExecutionQueue {
  private readonly queue: YExecutionQueue
  private readonly blocks: Y.Map<YBlock>
  private readonly layout: Y.Array<YBlockGroup>
  private readonly observers: Set<() => void> = new Set()
  private readonly options: ExecutionQueueOptions

  private constructor(
    doc: Y.Doc,
    options: Partial<ExecutionQueueOptions> = {}
  ) {
    this.queue = doc.getArray<YExecutionQueueBatch>('executionQueue')
    this.blocks = getBlocks(doc)
    this.layout = getLayout(doc)
    this.options = {
      ...defaultOptions,
      ...options,
    }
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
    environmentStartedAt: Date | null,
    metadata: ExecutionQueueItemMetadataWithoutNoop
  ): void {
    const bId =
      typeof blockId === 'string' ? blockId : getBaseAttributes(blockId).id
    const block =
      typeof blockId === 'string' ? this.blocks.get(blockId) : blockId
    if (!block) {
      return
    }

    const items: YExecutionQueueItem[] = []

    const dependencies = this.options.skipDependencyCheck
      ? []
      : computeDepencyQueue(
          block,
          this.layout,
          this.blocks,
          environmentStartedAt
        )
    for (const dep of dependencies) {
      const metadata = this.getExecutionQueueMetadataForBlock(dep)
      if (metadata) {
        const blockId = getBaseAttributes(dep).id
        items.push(createYExecutionQueueItem(blockId, userId, metadata))
      }
    }

    const item = createYExecutionQueueItem(bId, userId, metadata)
    items.push(item)

    const batch = createYExecutionQueueBatch(items, {
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

      const metadata = this.getExecutionQueueMetadataForBlock(block)

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

  public enqueueBlockOnwards(
    blockId: string | YBlock,
    userId: string | null,
    environmentStartedAt: Date | null,
    metadata: ExecutionQueueItemMetadataWithoutNoop
  ): void {
    const block =
      typeof blockId === 'string' ? this.blocks.get(blockId) : blockId
    if (!block) {
      return
    }

    const blocksAfter: YExecutionQueueItem[] = []
    let found = false
    for (const blockGroup of this.layout) {
      const tabs = blockGroup.getAttribute('tabs') ?? new Y.Array()
      for (const tab of tabs) {
        const tabBlockId = tab.getAttribute('id')
        if (!tabBlockId) {
          continue
        }

        if (tabBlockId === blockId) {
          found = true
          continue
        }

        if (found) {
          const block = this.blocks.get(tabBlockId)
          if (block) {
            const metadata = this.getExecutionQueueMetadataForBlock(block)
            if (!metadata) {
              continue
            }

            blocksAfter.push(
              createYExecutionQueueItem(tabBlockId, userId, metadata)
            )
          }
        }
      }
    }

    const bId =
      typeof blockId === 'string' ? blockId : getBaseAttributes(blockId).id

    const dependencies = this.options.skipDependencyCheck
      ? []
      : computeDepencyQueue(
          block,
          this.layout,
          this.blocks,
          environmentStartedAt
        )

    const blocksBefore: YExecutionQueueItem[] = []
    for (const dep of dependencies) {
      const metadata = this.getExecutionQueueMetadataForBlock(dep)
      if (!metadata) {
        continue
      }

      const blockId = getBaseAttributes(dep).id
      blocksBefore.push(createYExecutionQueueItem(blockId, userId, metadata))
    }

    const item = createYExecutionQueueItem(bId, userId, metadata)

    const batch = createYExecutionQueueBatch(
      [...blocksBefore, item, ...blocksAfter],
      {
        isRunAll: false,
        isSchedule: false,
      }
    )
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

        const metadata = this.getExecutionQueueMetadataForBlock(block)
        if (metadata) {
          const item = createYExecutionQueueItem(blockId, userId, metadata)
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

  public getExecutionQueueMetadataForBlock(
    block: YBlock
  ): ExecutionQueueItemMetadataWithoutNoop | null {
    return switchBlockType<ExecutionQueueItemMetadataWithoutNoop | null>(
      block,
      {
        onSQL: () => ({
          _tag: 'sql',
          isSuggestion: false,
          selectedCode: null,
        }),
        onPython: () => ({ _tag: 'python', isSuggestion: false }),
        onVisualization: () => ({ _tag: 'visualization' }),
        onInput: () => ({ _tag: 'text-input-save-value' }),
        onDateInput: () => ({ _tag: 'date-input' }),
        onDropdownInput: () => ({ _tag: 'dropdown-input-save-value' }),
        onWriteback: () => ({ _tag: 'writeback' }),
        onPivotTable: () => ({ _tag: 'pivot-table' }),
        onFileUpload: () => null,
        onRichText: () => null,
        onDashboardHeader: () => null,
      }
    )
  }

  public static fromYjs(
    doc: Y.Doc,
    options: Partial<ExecutionQueueOptions> = {}
  ): ExecutionQueue {
    return new ExecutionQueue(doc, options)
  }
}
