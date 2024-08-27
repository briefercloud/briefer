import { logger } from '../logger.js'
import { EventContext, NotebookEvents } from './index.js'

export class UserNotebookEvents implements NotebookEvents {
  public constructor(
    private readonly workspaceId: string,
    private readonly documentId: string
  ) {}

  public pythonRun(ctx: EventContext) {
    const user = this.getUser(ctx, 'pythonRun')
    if (!user) {
      return
    }

    // TODO
  }

  public sqlRun(ctx: EventContext) {
    const user = this.getUser(ctx, 'sqlRun')
    if (!user) {
      return
    }

    // TODO
  }

  public visUpdate(ctx: EventContext, chartType: string) {
    const user = this.getUser(ctx, 'visUpdate', { chartType })
    if (!user) {
      return
    }

    // TODO
  }

  public writeback(ctx: EventContext) {
    const user = this.getUser(ctx, 'writeback')
    if (!user) {
      return
    }

    // TODO:
  }

  public aiUsage(
    ctx: EventContext,
    type: 'sql' | 'python',
    action: 'edit' | 'fix',
    modelId: string | null
  ) {
    const user = this.getUser(ctx, 'aiUsage', { type, action, modelId })
    if (!user) {
      return
    }

    // TODO:
  }

  public blockAdd(ctx: EventContext, blockType: string) {
    const user = this.getUser(ctx, 'blockAdded', { blockType })
    if (!user) {
      return
    }

    // TODO:
  }

  private getUser(
    ctx: EventContext,
    eventName: string,
    logProps?: Record<string, any>
  ) {
    if (!ctx.user) {
      logger.error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          ...(logProps ?? {}),
        },
        `User not provided to UserNotebookEvents.${eventName}`
      )
      return null
    }

    return ctx.user
  }
}
