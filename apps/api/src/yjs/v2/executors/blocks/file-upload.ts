import PQueue from 'p-queue'
import { getJupyterManager } from '../../../../jupyter/index.js'

export interface IFileUploadExecutor {
  isIdle(): boolean
  deleteFile(fileName: string): Promise<void>
}

export class FileUploadExecutor implements IFileUploadExecutor {
  private workspaceId: string
  private executionQueue: PQueue

  constructor(workspaceId: string, executionQueue: PQueue) {
    this.workspaceId = workspaceId
    this.executionQueue = executionQueue
  }

  public isIdle() {
    return this.executionQueue.size === 0 && this.executionQueue.pending === 0
  }

  public async deleteFile(fileName: string) {
    await this.executionQueue.add(() => this._deleteFile(fileName))
  }

  private async _deleteFile(fileName: string) {
    const jupyterManager = getJupyterManager()
    await jupyterManager.deleteFile(this.workspaceId, fileName)
  }

  public static make(workspaceId: string) {
    return new FileUploadExecutor(workspaceId, new PQueue({ concurrency: 3 }))
  }
}
