import services from '@jupyterlab/services'
import { Readable } from 'stream'
import { Workspace } from '@briefer/database'
import { IOServer } from '../websocket/index.js'
import config from '../config/index.js'
import { ComposeJupyterManager } from './compose/index.js'

export type GetFileResult = {
  size: number
  stream: Readable
  exitCode: Promise<number>
}

export interface JupyterManager {
  start(socketSerever: IOServer): Promise<void>
  stop(): Promise<void>
  deploy(workspace: Workspace): Promise<void>
  restart(workspaceId: string): Promise<void>
  ensureRunning(workspaceId: string): Promise<void>
  isRunning(workspaceId: string): Promise<boolean>
  fileExists(workspaceId: string, fileName: string): Promise<boolean>
  getFile(workspaceId: string, fileName: string): Promise<GetFileResult | null>
  putFile(workspaceId: string, fileName: string, file: Readable): Promise<void>
  deleteFile(workspaceId: string, fileName: string): Promise<void>

  getServerSettings(
    workspaceId: string
  ): Promise<services.ServerConnection.ISettings>
}

let jupyterManagerInstance: JupyterManager | null = null
export function getJupyterManager(): JupyterManager {
  if (jupyterManagerInstance) {
    return jupyterManagerInstance
  }

  const conf = config()
  jupyterManagerInstance = new ComposeJupyterManager(
    conf.JUPYTER_HOST,
    conf.JUPYTER_PORT,
    conf.JUPYTER_TOKEN,
    conf.JUPYTER_FILES_DIR
  )

  return jupyterManagerInstance
}
