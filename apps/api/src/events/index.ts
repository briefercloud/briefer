import * as Y from 'yjs'
import { ApiUser } from '@briefer/database'

interface AIEvents {
  aiUsage: (
    ctx: EventContext,
    type: 'sql' | 'python',
    action: 'edit' | 'fix',
    modelId: string | null
  ) => void
}

export interface PythonEvents extends AIEvents {
  pythonRun: (ctx: EventContext) => void
}

export interface SQLEvents extends AIEvents {
  sqlRun: (ctx: EventContext) => void
}

export interface VisEvents {
  visUpdate: (ctx: EventContext, chartType: string) => void
}

export interface WritebackEvents extends AIEvents {
  writeback: (ctx: EventContext) => void
}

export interface NotebookBlockEvents {
  blockAdd: (ctx: EventContext, blockType: string) => void
}
export interface NotebookEvents
  extends PythonEvents,
    SQLEvents,
    VisEvents,
    WritebackEvents,
    NotebookBlockEvents {}

export class EventContext {
  constructor(
    public readonly user: ApiUser | null,
    public readonly scheduleId: string | null = null
  ) {}

  static fromYTransaction(tr: Y.Transaction): EventContext {
    const user = tr.origin && 'user' in tr.origin ? tr.origin.user : null
    const scheduleId =
      tr.origin && 'scheduleId' in tr.origin ? tr.origin.scheduleId : null

    return new EventContext(user, scheduleId)
  }
}
