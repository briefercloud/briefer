import axios from 'axios'
import qs from 'qs'
import { Readable } from 'stream'
import { z } from 'zod'

export const FileStat = z.object({
  name: z.string(),
  path: z.string(),
  size: z.number(),
  modified: z.number(),
  created: z.number(),
  mimeType: z.string().nullish(),
  isDirectory: z.boolean(),
})

export type FileStat = z.infer<typeof FileStat>

export type ReadFileResult =
  | {
      _tag: 'success'
      size: number
      stream: Readable
    }
  | {
      _tag: 'error'
      reason: 'not-found' | 'is-directory'
    }

export type StatFileResult =
  | {
      _tag: 'success'
      file: FileStat
    }
  | {
      _tag: 'error'
      reason: 'is-directory' | 'not-found'
    }

export type ListFilesResult =
  | {
      _tag: 'success'
      files: FileStat[]
    }
  | {
      _tag: 'error'
      reason: 'not-found' | 'not-directory'
    }

export type WriteFileResult =
  | {
      _tag: 'success'
    }
  | {
      _tag: 'error'
      reason: 'is-directory'
    }

export type DeleteFileResult =
  | {
      _tag: 'success'
    }
  | {
      _tag: 'error'
      reason: 'not-found' | 'is-directory'
    }

export class BrieferJupyterExtension {
  public constructor(
    private readonly host: string,
    private readonly port: number,
    private readonly token: string
  ) {}

  public async statFile(filePath: string): Promise<StatFileResult> {
    const params = qs.stringify({ filePath })
    const res = await axios.get(
      `http://${this.host}:${this.port}/api/briefer/files/stat?${params}`,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'json',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status === 404) {
      return { _tag: 'error', reason: 'not-found' }
    }

    if (res.status === 400) {
      z.object({ reason: z.literal('is-directory') }).parse(res.data)
      return { _tag: 'error', reason: 'is-directory' }
    }

    return {
      _tag: 'success',
      file: FileStat.parse(res.data),
    }
  }

  public async listFiles(dirPath: string): Promise<ListFilesResult> {
    const params = qs.stringify({ dirPath: dirPath })
    const res = await axios.get(
      `http://${this.host}:${this.port}/api/briefer/files/list?${params}`,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'json',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status === 400) {
      z.object({ reason: z.literal('not-directory') }).parse(res.data)
      return { _tag: 'error', reason: 'not-directory' }
    }

    return {
      _tag: 'success',
      files: z.array(FileStat).parse(res.data),
    }
  }

  public async readFile(filePath: string): Promise<ReadFileResult> {
    const statResult = await this.statFile(filePath)
    if (statResult._tag === 'error') {
      return statResult
    }

    if (statResult.file.isDirectory) {
      return { _tag: 'error', reason: 'is-directory' }
    }

    const params = qs.stringify({ filePath: filePath })
    const res = await axios.get<Readable>(
      `http://${this.host}:${this.port}/api/briefer/files/read?${params}`,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'stream',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status === 404) {
      return { _tag: 'error', reason: 'not-found' }
    }

    if (res.status === 400) {
      let response = ''
      await new Promise((resolve, reject) => {
        res.data.on('data', (chunk) => {
          response += chunk
        })
        res.data.on('end', resolve)
        res.data.on('error', reject)
      })
      z.object({ reason: z.literal('is-directory') }).parse(
        JSON.parse(response)
      )
      return { _tag: 'error', reason: 'is-directory' }
    }

    return {
      _tag: 'success',
      size: statResult.file.size,
      stream: res.data,
    }
  }

  public async writeFile(
    filePath: string,
    stream: Readable
  ): Promise<WriteFileResult> {
    const params = qs.stringify({ filePath: filePath })
    const res = await axios.post(
      `http://${this.host}:${this.port}/api/briefer/files/write?${params}`,
      stream,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'json',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status === 400) {
      z.object({ reason: z.literal('is-directory') }).parse(res.data)
      return { _tag: 'error', reason: 'is-directory' }
    }

    return { _tag: 'success' }
  }

  public async deleteFile(filePath: string): Promise<DeleteFileResult> {
    const params = qs.stringify({ filePath: filePath })
    const res = await axios.delete(
      `http://${this.host}:${this.port}/api/briefer/files/remove?${params}`,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'json',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status === 404) {
      return { _tag: 'error', reason: 'not-found' }
    }

    if (res.status === 400) {
      z.object({ reason: z.literal('is-directory') }).parse(res.data)
      return { _tag: 'error', reason: 'is-directory' }
    }

    return { _tag: 'success' }
  }

  public async getCWD(): Promise<string> {
    const res = await axios.get(
      `http://${this.host}:${this.port}/api/briefer/cwd`,
      {
        headers: {
          Authorization: `token ${this.token}`,
        },
        responseType: 'json',
        validateStatus: (code) => code < 500,
      }
    )

    if (res.status !== 200) {
      throw new Error(`Failed to get CWD. Status: ${res.status}`)
    }

    return z.object({ cwd: z.string() }).parse(res.data).cwd
  }
}
