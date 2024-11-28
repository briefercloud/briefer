import { ApiUser } from '@briefer/database'
import { NotebookEvents } from './index.js'
import { capturePythonRun, captureSQLRun } from './posthog.js'

export class UserNotebookEvents implements NotebookEvents {
  public constructor(
    private readonly workspaceId: string,
    private readonly documentId: string,
    private readonly user: ApiUser
  ) {}

  public pythonRun() {
    capturePythonRun(this.user, this.workspaceId, this.documentId)
  }

  public sqlRun() {
    captureSQLRun(this.user, this.workspaceId, this.documentId)
  }

  public visUpdate() {}

  public writeback() {}

  public aiUsage() {}

  public blockAdd() {}
}
