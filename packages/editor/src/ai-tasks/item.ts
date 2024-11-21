import * as Y from 'yjs'
import * as z from 'zod'
import { uuidSchema } from '../utils.js'

export const AITaskItemStatus = z.union([
  z.object({
    _tag: z.literal('enqueued'),
  }),
  z.object({
    _tag: z.literal('aborting'),
  }),
  z.object({
    _tag: z.literal('running'),
    ping: z.number().positive(),
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
export type AITaskItemStatus = z.infer<typeof AITaskItemStatus>

export type AITaskStatus = AITaskItemStatus['_tag'] | 'idle'

export function isAITaskStatusLoading(
  status: AITaskStatus
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

export const AITaskItemEditPythonMetadata = z.object({
  _tag: z.literal('edit-python'),
})
export type AITaskItemEditPythonMetadata = z.infer<
  typeof AITaskItemEditPythonMetadata
>

export const AITaskItemFixPythonMetadata = z.object({
  _tag: z.literal('fix-python'),
})
export type AITaskItemFixPythonMetadata = z.infer<
  typeof AITaskItemFixPythonMetadata
>

export const AITaskItemNoopMetadata = z.object({
  _tag: z.literal('noop'),
})
export type AITaskItemNoopMetadata = z.infer<typeof AITaskItemNoopMetadata>

export const AITaskItemMetadata = z.union([
  AITaskItemEditPythonMetadata,
  AITaskItemFixPythonMetadata,
  AITaskItemNoopMetadata,
])
export type AITaskItemMetadata = z.infer<typeof AITaskItemMetadata>

export type AITaskItemMetadataWithoutNoop = Exclude<
  AITaskItemMetadata,
  AITaskItemNoopMetadata
>

export const AITaskItemAttrs = z.object({
  blockId: uuidSchema,
  userId: z.nullable(uuidSchema),
  status: AITaskItemStatus,
  metadata: AITaskItemMetadata,
})
export type YAITaskItemAttrs = z.infer<typeof AITaskItemAttrs>

export type YAITaskItem = Y.XmlElement<YAITaskItemAttrs>

export function createYAITaskItem(
  blockId: string,
  userId: string | null,
  metadata: AITaskItemMetadataWithoutNoop
): YAITaskItem {
  const el = new Y.XmlElement<YAITaskItemAttrs>()
  const attrs: YAITaskItemAttrs = {
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

export class AITaskItem {
  private constructor(private readonly item: YAITaskItem) {}
  private statusObservers: Set<(status: AITaskItemStatus) => void> = new Set()

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

  public getMetadata(): AITaskItemMetadata {
    return this.item.getAttribute('metadata') ?? { _tag: 'noop' }
  }

  public getBlockId(): string {
    return this.item.getAttribute('blockId') ?? ''
  }

  public getUserId(): string | null {
    return this.item.getAttribute('userId') ?? null
  }

  public setRunning(): void {
    this.item.setAttribute('status', { _tag: 'running', ping: Date.now() })
  }

  public ping(): void {
    this.setRunning()
  }

  public setAborting(): void {
    this.item.setAttribute('status', { _tag: 'aborting' })
  }

  public setCompleted(status: 'success' | 'error' | 'aborted'): void {
    this.item.setAttribute('status', { _tag: 'completed', status })
  }

  public getStatus(): AITaskItemStatus {
    const raw = this.item.getAttribute('status')
    if (!raw) {
      return { _tag: 'unknown' }
    }

    const parsed = AITaskItemStatus.safeParse(raw)
    if (!parsed.success) {
      return { _tag: 'unknown' }
    }

    return parsed.data
  }

  public observeStatus(
    callback: (status: AITaskItemStatus) => void
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

  public static fromYjs(item: YAITaskItem): AITaskItem {
    return new AITaskItem(item)
  }
}
