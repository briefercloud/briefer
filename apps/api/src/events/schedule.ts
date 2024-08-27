import { logger } from '../logger.js'
import { EventContext, NotebookEvents } from './index.js'

export class ScheduleNotebookEvents implements NotebookEvents {
  public constructor(
    private readonly workspaceId: string,
    private readonly documentId: string
  ) {}

  public pythonRun(ctx: EventContext) {
    const scheduleId = this.getScheduleId(ctx, 'pythonRun')
    if (!scheduleId) {
      return
    }

    // TODO:
  }

  public sqlRun(ctx: EventContext) {
    const scheduleId = this.getScheduleId(ctx, 'sqlRun')
    if (!scheduleId) {
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
    const scheduleId = this.getScheduleId(ctx, 'aiUsage', {
      type,
      action,
      modelId,
    })
    if (!scheduleId) {
      return
    }

    logger.error(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        type,
        action,
        modelId,
        scheduleId,
      },
      'Got unexpected aiUsage event in ScheduleNotebookEvents'
    )
  }

  public visUpdate(ctx: EventContext, chartType: string) {
    const scheduleId = this.getScheduleId(ctx, 'visUpdate', { chartType })
    if (!scheduleId) {
      return
    }

    // TODO:
  }

  public writeback(ctx: EventContext) {
    const scheduleId = this.getScheduleId(ctx, 'writeback')
    if (!scheduleId) {
      return
    }

    // TODO:
  }

  public blockAdd(ctx: EventContext, blockType: string) {
    const scheduleId = this.getScheduleId(ctx, 'blockAdded', { blockType })
    if (!scheduleId) {
      return
    }

    logger.error(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockType,
        scheduleId,
      },
      'Got unexpected blockAdded event in ScheduleNotebookEvents'
    )
  }

  private getScheduleId(
    ctx: EventContext,
    eventName: string,
    logProps?: Record<string, any>
  ) {
    if (!ctx.scheduleId) {
      logger.error(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          ...(logProps ?? {}),
        },
        `Schedule Id not provided to ScheduleNotebookEvents.${eventName}`
      )
      return null
    }

    return ctx.scheduleId
  }
}
