import { z } from 'zod'
import { PythonExecutionError, executeCode } from './index.js'
import { BrieferFile, jsonString } from '@briefer/types'
import { Readable } from 'stream'
import { GetFileResult, getJupyterManager } from '../jupyter/index.js'

interface BrieferFilesService {
  get: (path: string) => Promise<GetFileResult | null>
  list: () => Promise<BrieferFile[]>
  delete: (path: string) => Promise<void>

  // returns true when file already exists
  upload: (path: string, replace: boolean, req: Readable) => Promise<boolean>
}

function listFilesCode(path: string): string {
  const code = `def _briefer_list_files(path):
    import os
    import json
    import mimetypes

    files = []
    for file in os.listdir(path):
        file_path = os.path.join(path, file)
        if os.path.isfile(file_path):
            # relative path to cwd
            cwd = os.getcwd()
            rel_cwd_path = os.path.relpath(file_path, cwd)
            files.append({
                "name": file,
                "path": file_path,
                "relCwdPath": rel_cwd_path,
                "size": os.path.getsize(file_path),
                "mimeType": mimetypes.guess_type(file_path)[0],
                "createdAt": os.path.getctime(file_path),
            })

    print(json.dumps({"success": True, "files": files}, default=str))

_briefer_list_files(${JSON.stringify(path)})`
  return code
}

function deleteFileCode(path: string): string {
  const code = `def _briefer_delete_file(path):
    import os
    import json
    os.remove(path)

    print(json.dumps({"success": True}))

_briefer_delete_file(${JSON.stringify(path)})`
  return code
}

class PythonBrieferFilesService implements BrieferFilesService {
  constructor(private readonly workspaceId: string) {}

  async list(): Promise<BrieferFile[]> {
    await getJupyterManager().ensureRunning(this.workspaceId)

    const code = listFilesCode('/home/jupyteruser')
    let files: BrieferFile[] | null = null
    let error: Error | null = null
    await (
      await executeCode(
        this.workspaceId,
        'files',
        code,
        (outputs) => {
          for (const output of outputs) {
            switch (output.type) {
              case 'stdio':
                {
                  const parsed = jsonString
                    .pipe(
                      z.object({
                        success: z.literal(true),
                        files: z.array(BrieferFile),
                      })
                    )
                    .safeParse(output.text)

                  if (parsed.success) {
                    files = parsed.data.files
                  } else {
                    error = parsed.error
                  }
                }
                break
              case 'error':
                {
                  error = new PythonExecutionError(
                    output.type,
                    output.ename,
                    output.evalue,
                    output.traceback
                  )
                }
                break
              default:
                {
                  error = new Error(`Unexpected output type: ${output.type}`)
                }
                break
            }
          }
        },
        {
          storeHistory: false,
        }
      )
    ).promise

    if (!files) {
      if (error) {
        throw error
      }
      throw new Error(
        `Failed to list files of workspace ${this.workspaceId}. No output.`
      )
    }

    return files
  }

  async delete(path: string): Promise<void> {
    await getJupyterManager().ensureRunning(this.workspaceId)

    const code = deleteFileCode(path)
    let success = false
    let error: Error | null = null
    await (
      await executeCode(
        this.workspaceId,
        'files',
        code,
        (outputs) => {
          for (const output of outputs) {
            switch (output.type) {
              case 'stdio':
                {
                  const parsed = jsonString
                    .pipe(
                      z.object({
                        success: z.literal(true),
                      })
                    )
                    .safeParse(output.text)

                  if (parsed.success) {
                    success = true
                  } else {
                    error = parsed.error
                  }
                }
                break
              case 'error':
                {
                  error = new PythonExecutionError(
                    output.type,
                    output.ename,
                    output.evalue,
                    output.traceback
                  )
                }
                break
              default:
                {
                  error = new Error(`Unexpected output type: ${output.type}`)
                }
                break
            }
          }
        },
        { storeHistory: false }
      )
    ).promise

    if (!success) {
      if (error) {
        throw error
      }

      throw new Error(
        `Failed to delete file ${JSON.stringify(path)} from workspace ${
          this.workspaceId
        }. No output.`
      )
    }
  }

  public async get(path: string): Promise<GetFileResult | null> {
    const jupyterManager = getJupyterManager()
    await jupyterManager.ensureRunning(this.workspaceId)
    return jupyterManager.getFile(this.workspaceId, path)
  }

  public async upload(
    fileName: string,
    replace: boolean,
    req: Readable
  ): Promise<boolean> {
    const jupyterManager = getJupyterManager()
    await jupyterManager.ensureRunning(this.workspaceId)

    if (!replace) {
      const fileExists = await jupyterManager.fileExists(
        this.workspaceId,
        fileName
      )
      if (fileExists) {
        return true
      }
    }

    await jupyterManager.putFile(this.workspaceId, fileName, req)

    return false
  }
}

export default PythonBrieferFilesService
