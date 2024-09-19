import { logger } from '../logger.js'
import { EventContext, NotebookEvents } from './index.js'
import { capturePythonRun, captureSQLRun } from './posthog.js'

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

    capturePythonRun(user, this.workspaceId, this.documentId)
  }

  public sqlRun(ctx: EventContext) {
    const user = this.getUser(ctx, 'sqlRun')
    if (!user) {
      return
    }

    captureSQLRun(user, this.workspaceId, this.documentId)
  }

  public visUpdate() {}

  public writeback() {}

  public aiUsage() {}

  public blockAdd() {}

  private getUser(
    ctx: EventContext,
    eventName: string,
    logProps?: Record<string, any>
  ) {
    if (!ctx.user) {
      logger().error(
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
