import * as Y from 'yjs'
import * as z from 'zod'
import { uuidSchema } from '../utils.js'

export const ExecutionQueueItemStatus = z.union([
  z.object({
    _tag: z.literal('enqueued'),
  }),
  z.object({
    _tag: z.literal('aborting'),
  }),
  z.object({
    _tag: z.literal('running'),
  }),
  z.object({
    _tag: z.literal('completed'),
    status: z.union([
      z.literal('success'),
      z.literal('error'),
      z.literal('aborted'),
    ]),
  }),
  z.object({
    _tag: z.literal('unknown'),
  }),
])
export type ExecutionQueueItemStatus = z.infer<typeof ExecutionQueueItemStatus>

export type ExecutionStatus = ExecutionQueueItemStatus['_tag'] | 'idle'

export function isExecutionStatusLoading(
  status: ExecutionStatus
): status is 'running' | 'aborting' | 'enqueued' {
  switch (status) {
    case 'enqueued':
    case 'running':
    case 'aborting':
      return true
    case 'idle':
    case 'completed':
    case 'unknown':
      return false
  }
}

export const ExecutionQueueItemPythonMetadata = z.object({
  _tag: z.literal('python'),
  isSuggestion: z.boolean(),
})
export type ExecutionQueueItemPythonMetadata = z.infer<
  typeof ExecutionQueueItemPythonMetadata
>

export const ExecutionQueueItemSQLMetadata = z.object({
  _tag: z.literal('sql'),
  isSuggestion: z.boolean(),
  selectedCode: z.string().nullable(),
})
export type ExecutionQueueItemSQLMetadata = z.infer<
  typeof ExecutionQueueItemSQLMetadata
>

export const ExecutionQueueItemSQLLoadPageMetadata = z.object({
  _tag: z.literal('sql-load-page'),
})
export type ExecutionQueueItemSQLLoadPageMetadata = z.infer<
  typeof ExecutionQueueItemSQLLoadPageMetadata
>

export const ExecutionQueueItemSQLRenameDataframeMetadata = z.object({
  _tag: z.literal('sql-rename-dataframe'),
})
export type ExecutionQueueItemSQLRenameDataframeMetadata = z.infer<
  typeof ExecutionQueueItemSQLRenameDataframeMetadata
>

export const ExecutionQueueItemVisualizationMetadata = z.object({
  _tag: z.literal('visualization'),
})
export type ExecutionQueueItemVisualizationMetadata = z.infer<
  typeof ExecutionQueueItemVisualizationMetadata
>

export const ExecutionQueueItemVisualizationV2Metadata = z.object({
  _tag: z.literal('visualization-v2'),
})
export type ExecutionQueueItemVisualizationV2Metadata = z.infer<
  typeof ExecutionQueueItemVisualizationV2Metadata
>

export const ExecutionQueueItemTextInputSaveValueMetadata = z.object({
  _tag: z.literal('text-input-save-value'),
})
export type ExecutionQueueItemTextInputSaveValueMetadata = z.infer<
  typeof ExecutionQueueItemTextInputSaveValueMetadata
>

export const ExecutionQueueItemTextInputRenameVariableMetadata = z.object({
  _tag: z.literal('text-input-rename-variable'),
})
export type ExecutionQueueItemTextInputRenameVariableMetadata = z.infer<
  typeof ExecutionQueueItemTextInputRenameVariableMetadata
>

export const ExecutionQueueItemDropdownInputSaveValueMetadata = z.object({
  _tag: z.literal('dropdown-input-save-value'),
})
export type ExecutionQueueItemDropdownInputSaveValueMetadata = z.infer<
  typeof ExecutionQueueItemDropdownInputSaveValueMetadata
>

export const ExecutionQueueItemDropdownInputRenameVariableMetadata = z.object({
  _tag: z.literal('dropdown-input-rename-variable'),
})
export type ExecutionQueueItemDropdownInputRenameVariableMetadata = z.infer<
  typeof ExecutionQueueItemDropdownInputRenameVariableMetadata
>

export const ExecutionQueueItemDateInputMetadata = z.object({
  _tag: z.literal('date-input'),
})
export type ExecutionQueueItemDateInputMetadata = z.infer<
  typeof ExecutionQueueItemDateInputMetadata
>

export const ExecutionQueueItemPivotTableMetadata = z.object({
  _tag: z.literal('pivot-table'),
})
export type ExecutionQueueItemPivotTableMetadata = z.infer<
  typeof ExecutionQueueItemPivotTableMetadata
>

export const ExecutionQueueItemPivotTableLoadPageMetadata = z.object({
  _tag: z.literal('pivot-table-load-page'),
})
export type ExecutionQueueItemPivotTableLoadPageMetadata = z.infer<
  typeof ExecutionQueueItemPivotTableLoadPageMetadata
>

export const ExecutionQueueItemWritebackMetadata = z.object({
  _tag: z.literal('writeback'),
})
export type ExecutionQueueItemWritebackMetadata = z.infer<
  typeof ExecutionQueueItemWritebackMetadata
>

export const ExecutionQueueItemNoopMetadata = z.object({
  _tag: z.literal('noop'),
})
export type ExecutionQueueItemNoopMetadata = z.infer<
  typeof ExecutionQueueItemNoopMetadata
>

export const ExecutionQueueItemMetadata = z.union([
  ExecutionQueueItemPythonMetadata,
  ExecutionQueueItemSQLMetadata,
  ExecutionQueueItemSQLLoadPageMetadata,
  ExecutionQueueItemSQLRenameDataframeMetadata,
  ExecutionQueueItemVisualizationMetadata,
  ExecutionQueueItemVisualizationV2Metadata,
  ExecutionQueueItemTextInputSaveValueMetadata,
  ExecutionQueueItemTextInputRenameVariableMetadata,
  ExecutionQueueItemDateInputMetadata,
  ExecutionQueueItemDropdownInputSaveValueMetadata,
  ExecutionQueueItemDropdownInputRenameVariableMetadata,
  ExecutionQueueItemPivotTableMetadata,
  ExecutionQueueItemPivotTableLoadPageMetadata,
  ExecutionQueueItemWritebackMetadata,
  ExecutionQueueItemNoopMetadata,
])
export type ExecutionQueueItemMetadata = z.infer<
  typeof ExecutionQueueItemMetadata
>

export type ExecutionQueueItemMetadataWithoutNoop = Exclude<
  ExecutionQueueItemMetadata,
  ExecutionQueueItemNoopMetadata
>

export const ExecutionQueueItemAttrs = z.object({
  blockId: uuidSchema,
  userId: z.nullable(uuidSchema),
  status: ExecutionQueueItemStatus,
  metadata: ExecutionQueueItemMetadata,
})
export type YExecutionQueueItemAttrs = z.infer<typeof ExecutionQueueItemAttrs>

export type YExecutionQueueItem = Y.XmlElement<YExecutionQueueItemAttrs>

export function createYExecutionQueueItem(
  blockId: string,
  userId: string | null,
  metadata: ExecutionQueueItemMetadataWithoutNoop
): YExecutionQueueItem {
  const el = new Y.XmlElement<YExecutionQueueItemAttrs>()
  const attrs: YExecutionQueueItemAttrs = {
    blockId,
    userId,
    status: { _tag: 'enqueued' },
    metadata,
  }
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }
  return el
}

export type MetadataCallbacks<T> = {
  python: (metadata: ExecutionQueueItemPythonMetadata) => T
  sql: (metadata: ExecutionQueueItemSQLMetadata) => T
}

export class ExecutionQueueItem {
  private constructor(private readonly item: YExecutionQueueItem) {}
  private statusObservers: Set<(status: ExecutionQueueItemStatus) => void> =
    new Set()

  public getCompleteStatus(): 'success' | 'error' | 'aborted' | null {
    const status = this.getStatus()
    switch (status._tag) {
      case 'completed':
        return status.status
      case 'enqueued':
      case 'running':
      case 'aborting':
      case 'unknown':
        return null
    }
  }

  public getMetadata(): ExecutionQueueItemMetadata {
    return this.item.getAttribute('metadata') ?? { _tag: 'noop' }
  }

  public getBlockId(): string {
    return this.item.getAttribute('blockId') ?? ''
  }

  public getUserId(): string | null {
    return this.item.getAttribute('userId') ?? null
  }

  public setRunning(): void {
    this.item.setAttribute('status', { _tag: 'running' })
  }

  public setAborting(): void {
    this.item.setAttribute('status', { _tag: 'aborting' })
  }

  public setCompleted(status: 'success' | 'error' | 'aborted'): void {
    this.item.setAttribute('status', { _tag: 'completed', status })
  }

  public getStatus(): ExecutionQueueItemStatus {
    const raw = this.item.getAttribute('status')
    if (!raw) {
      return { _tag: 'unknown' }
    }

    const parsed = ExecutionQueueItemStatus.safeParse(raw)
    if (!parsed.success) {
      return { _tag: 'unknown' }
    }

    return parsed.data
  }

  public observeStatus(
    callback: (status: ExecutionQueueItemStatus) => void
  ): () => void {
    this.statusObservers.add(callback)
    if (this.statusObservers.size === 1) {
      this.item.observeDeep(this.onStatusObservation)
    }

    return () => {
      this.statusObservers.delete(callback)
      if (this.statusObservers.size === 0) {
        this.item.unobserveDeep(this.onStatusObservation)
      }
    }
  }

  public toJSON() {
    return this.item.getAttributes()
  }

  private onStatusObservation = () => {
    const status = this.getStatus()
    this.statusObservers.forEach((cb) => cb(status))
  }

  public static fromYjs(item: YExecutionQueueItem): ExecutionQueueItem {
    return new ExecutionQueueItem(item)
  }
}
