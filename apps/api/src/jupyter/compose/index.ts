import fs from 'fs'
import fsp from 'fs/promises'
import { IOServer } from '../../websocket/index.js'
import { WebSocket } from 'ws'
import services from '@jupyterlab/services'
import {
  serialize,
  deserialize,
} from '@jupyterlab/services/lib/kernel/serialize.js'
import { GetFileResult, JupyterManager } from '../index.js'
import path from 'path'
import { Readable } from 'stream'
import prisma from '@briefer/database'
import { broadcastEnvironmentStatus } from '../../websocket/workspace/environment.js'
import { logger } from '../../logger.js'

export class ComposeJupyterManager implements JupyterManager {
  private watchTimeout: NodeJS.Timeout | null = null
  private socketServer: IOServer | null = null

  public constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly token: string,
    private readonly filesDir: string
  ) {}

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

        const serverSettings = await this.getServerSettings(workspace.id)
        const url = `${serverSettings.baseUrl}/api/status`
        const options = {
          headers: {
            Authorization: `token ${serverSettings.token}`,
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
          logger.error(
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

    const kernels = await this.getKernels()
    for (const kernel of kernels) {
      await this.restartKernel(kernel.id)
    }

    broadcastEnvironmentStatus(
      this.socketServer,
      workspaceId,
      'Running',
      new Date().toISOString()
    )
  }

  private async getKernels() {
    const res = await fetch(`http://${this.host}:${this.port}/api/kernels`, {
      headers: {
        Authorization: `token ${this.token}`,
      },
    })

    return res.json()
  }

  private async restartKernel(kernelId: string) {
    const res = await fetch(
      `http://${this.host}:${this.port}/api/kernels/${kernelId}/restart`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${this.token}`,
        },
      }
    )

    if (!res.ok) {
      throw new Error(
        `Failed to restart kernel ${kernelId}. Status: ${res.status}`
      )
    }
  }

  public async ensureRunning(): Promise<void> {}

  public async isRunning(): Promise<boolean> {
    return true
  }

  public async fileExists(
    _workspaceId: string,
    fileName: string
  ): Promise<boolean> {
    try {
      await fsp.access(this.getFilepath(fileName))
      return true
    } catch (err) {
      return false
    }
  }

  public async getFile(
    _workspaceId: string,
    fileName: string
  ): Promise<GetFileResult | null> {
    const actualPath = this.getFilepath(fileName)

    const stat = await fsp.stat(actualPath)
    const size = stat.size

    const stream = fs.createReadStream(actualPath)

    return {
      size,
      stream,
      exitCode: new Promise<number>((resolve, reject) => {
        stream.on('error', reject)
        stream.on('finish', () => {
          resolve(0)
        })
      }),
    }
  }

  public async putFile(
    _workspaceId: string,
    fileName: string,
    file: Readable
  ): Promise<void> {
    const stream = fs.createWriteStream(this.getFilepath(fileName))
    file.pipe(stream)
    await new Promise<void>((resolve, reject) => {
      stream.on('error', reject)
      stream.on('finish', resolve)
    })
  }

  public async deleteFile(
    _workspaceId: string,
    fileName: string
  ): Promise<void> {
    await fsp.unlink(this.getFilepath(fileName))
  }

  public async getServerSettings(
    _workspaceId: string
  ): Promise<services.ServerConnection.ISettings> {
    const baseConfig = {
      baseUrl: `http://${this.host}:${this.port}`,
      appUrl: `http://${this.host}:${this.port}`,
      wsUrl: `ws://${this.host}:${this.port}`,
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

  private getFilepath(fileName: string): string {
    return path.join(this.filesDir, path.join('/', fileName))
  }
}
