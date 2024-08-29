import services from '@jupyterlab/services'
import { Readable } from 'stream'
import { Workspace } from '@briefer/database'
import { IOServer } from '../websocket/index.js'
import config from '../config/index.js'
import { BrieferFile } from '@briefer/types'
import { JupyterManager } from './manager.js'

export type GetFileResult = {
  size: number
  stream: Readable
  exitCode: Promise<number>
}

export interface IJupyterManager {
  start(socketSerever: IOServer): Promise<void>
  stop(): Promise<void>
  deploy(workspace: Workspace): Promise<void>
  restart(workspaceId: string): Promise<void>
  ensureRunning(workspaceId: string): Promise<void>
  isRunning(workspaceId: string): Promise<boolean>
  fileExists(workspaceId: string, fileName: string): Promise<boolean>
  listFiles(workspaceId: string): Promise<BrieferFile[]>
  getFile(workspaceId: string, fileName: string): Promise<GetFileResult | null>

  putFile(
    workspaceId: string,
    fileName: string,
    replace: boolean,
    file: Readable
  ): Promise<'success' | 'already-exists'>

  deleteFile(workspaceId: string, fileName: string): Promise<void>

  getServerSettings(
    workspaceId: string
  ): Promise<services.ServerConnection.ISettings>
}

let jupyterManagerInstance: IJupyterManager | null = null
export function getJupyterManager(): IJupyterManager {
  if (jupyterManagerInstance) {
    return jupyterManagerInstance
  }

  const conf = config()
  jupyterManagerInstance = new JupyterManager(
    conf.JUPYTER_PROTOCOL,
    conf.JUPYTER_HOST,
    conf.JUPYTER_PORT,
    conf.JUPYTER_TOKEN
  )

  return jupyterManagerInstance
}
