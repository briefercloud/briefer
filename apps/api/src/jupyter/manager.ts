import { IOServer } from '../websocket/index.js'
import { WebSocket } from 'ws'
import services from '@jupyterlab/services'
import {
  serialize,
  deserialize,
} from '@jupyterlab/services/lib/kernel/serialize.js'
import { GetFileResult, IJupyterManager } from './index.js'
import path from 'path'
import { Readable } from 'stream'
import prisma from '@briefer/database'
import { broadcastEnvironmentStatus } from '../websocket/workspace/environment.js'
import { logger } from '../logger.js'
import { BrieferJupyterExtension } from './extension.js'
import { BrieferFile } from '@briefer/types'
import { disposeAll, updateEnvironmentVariables } from '../python/index.js'

export class JupyterManager implements IJupyterManager {
  private watchTimeout: NodeJS.Timeout | null = null
  private socketServer: IOServer | null = null
  private jupyterExtension: BrieferJupyterExtension

  public constructor(
    private readonly protocol: string,
    private readonly host: string,
    private readonly port: number | null,
    private readonly token: string
  ) {
    this.jupyterExtension = new BrieferJupyterExtension(
      protocol,
      host,
      port,
      token
    )
  }

  private get baseURL(): string {
    if (this.port === null) {
      return `${this.protocol}://${this.host}`
    }

    return `${this.protocol}://${this.host}:${this.port}`
  }

  public async start(socketServer: IOServer): Promise<void> {
    this.socketServer = socketServer
    const watch = async () => {
      const workspaces = await prisma().workspace.findMany({
        select: { id: true },
      })

      for (const workspace of workspaces) {
        let environment = await prisma().environment.findFirst({
          where: { workspaceId: workspace.id },
        })
        if (!environment) {
          environment = await prisma().environment.create({
            data: {
              workspaceId: workspace.id,
              status: 'Stopped',
              resourceVersion: 0,
            },
          })
        }

        const url = `${this.baseURL}/api/status`
        const options = {
          headers: {
            Authorization: `token ${this.token}`,
          },
        }

        try {
          const res = await fetch(url, options)
          if (res.ok) {
            if (environment.status !== 'Running') {
              environment = await prisma().environment.update({
                where: { id: environment.id },
                data: { status: 'Running', startedAt: new Date() },
              })
            }

            broadcastEnvironmentStatus(
              socketServer,
              workspace.id,
              'Running',
              environment.startedAt?.toISOString() ?? null
            )
          } else {
            broadcastEnvironmentStatus(
              socketServer,
              workspace.id,
              'Stopped',
              null
            )
          }
        } catch (err) {
          logger().error(
            {
              workspaceId: workspace.id,
              err,
            },
            'Failed to check if Jupyter is running'
          )
        }
      }
      this.watchTimeout = setTimeout(watch, 5000)
    }
    await watch()
  }

  public async stop(): Promise<void> {
    if (this.watchTimeout) {
      clearTimeout(this.watchTimeout)
    }
  }

  public async deploy(): Promise<void> {}

  public async restart(workspaceId: string): Promise<void> {
    if (!this.socketServer) {
      throw new Error(`ContainerJupyterManager not started`)
    }

    broadcastEnvironmentStatus(this.socketServer, workspaceId, 'Stopping', null)

    await disposeAll(workspaceId)

    broadcastEnvironmentStatus(
      this.socketServer,
      workspaceId,
      'Running',
      new Date().toISOString()
    )
  }

  public async ensureRunning(): Promise<void> {}

  public async isRunning(): Promise<boolean> {
    return true
  }

  public async fileExists(
    _workspaceId: string,
    fileName: string
  ): Promise<boolean> {
    await this.ensureRunning()
    const result = await this.jupyterExtension.statFile(
      await this.getFilepath(fileName)
    )
    if (result._tag === 'error') {
      if (result.reason === 'not-found') {
        return false
      }

      throw new Error(`Failed to stat file: ${result.reason}`)
    }

    return true
  }

  public async getFile(
    _workspaceId: string,
    fileName: string
  ): Promise<GetFileResult | null> {
    await this.ensureRunning()
    const actualPath = await this.getFilepath(fileName)

    const result = await this.jupyterExtension.readFile(actualPath)
    if (result._tag === 'error') {
      if (result.reason === 'not-found') {
        return null
      }

      throw new Error(`Failed to read file: ${result.reason}`)
    }

    return {
      size: result.size,
      stream: result.stream,
      exitCode: new Promise<number>((resolve, reject) => {
        result.stream.on('error', reject)
        result.stream.on('finish', () => {
          resolve(0)
        })
      }),
    }
  }

  public async putFile(
    _workspaceId: string,
    fileName: string,
    replace: boolean,
    file: Readable
  ): Promise<'success' | 'already-exists'> {
    await this.ensureRunning()
    const statResult = await this.jupyterExtension.statFile(
      await this.getFilepath(fileName)
    )
    if (statResult._tag === 'error' && statResult.reason !== 'not-found') {
      throw new Error(`Failed to stat file: ${statResult.reason}`)
    }

    if (statResult._tag === 'success' && !replace) {
      return 'already-exists'
    }

    const result = await this.jupyterExtension.writeFile(
      await this.getFilepath(fileName),
      file
    )
    if (result._tag === 'error') {
      throw new Error(`Failed to write file: ${result.reason}`)
    }

    return 'success'
  }

  public async deleteFile(
    _workspaceId: string,
    fileName: string
  ): Promise<void> {
    await this.ensureRunning()
    const result = await this.jupyterExtension.deleteFile(
      await this.getFilepath(fileName)
    )
    if (result._tag === 'error' && result.reason !== 'not-found') {
      throw new Error(`Failed to delete file: ${result.reason}`)
    }
  }

  public async listFiles(_workspaceId: string): Promise<BrieferFile[]> {
    await this.ensureRunning()
    const cwd = await this.jupyterExtension.getCWD()
    const result = await this.jupyterExtension.listFiles(cwd)
    if (result._tag === 'error') {
      throw new Error(`Failed to list files: ${result.reason}`)
    }

    return result.files.map((f) => ({
      name: f.name,
      path: f.path,
      relCwdPath: path.relative(cwd, f.path),
      size: f.size,
      mimeType: f.mimeType ?? null,
      createdAt: f.created,
      isDirectory: f.isDirectory,
    }))
  }

  public async getServerSettings(
    _workspaceId: string
  ): Promise<services.ServerConnection.ISettings> {
    const wsUrl = this.baseURL.replace(
      this.protocol,
      this.protocol === 'https' ? 'wss' : 'ws'
    )

    const baseConfig = {
      baseUrl: this.baseURL,
      appUrl: this.baseURL,
      wsUrl,
    }

    const serverSettings: services.ServerConnection.ISettings = {
      ...baseConfig,
      serializer: {
        serialize,
        deserialize,
      },
      token: this.token,
      init: {},
      appendToken: true,
      fetch,
      Request,
      Headers,

      // @ts-ignore
      WebSocket,
    }

    return serverSettings
  }

  public async setEnvironmentVariables(
    workspaceId: string,
    variables: { add: { name: string; value: string }[]; remove: string[] }
  ): Promise<void> {
    await this.ensureRunning()
    await updateEnvironmentVariables(workspaceId, variables)
  }

  private async getFilepath(fileName: string): Promise<string> {
    const cwd = await this.jupyterExtension.getCWD()
    return path.join(cwd, path.join('/', fileName))
  }
}
