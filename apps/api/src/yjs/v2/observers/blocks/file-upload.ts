import {
  FileUploadBlock,
  UploadedFile,
  removeUploadedFile,
  updateUploadedFile,
} from '@briefer/editor'
import * as Y from 'yjs'
import { IBlockObserver } from './index.js'
import {
  IFileUploadExecutor,
  FileUploadExecutor,
} from '../../executors_/blocks/file-upload.js'
import { logger } from '../../../../logger.js'
import { equals } from 'ramda'

export interface IFileUploadObserver extends IBlockObserver<FileUploadBlock> {}

export class FileUploadObserver implements IFileUploadObserver {
  private workspaceId: string
  private documentId: string
  private executor: IFileUploadExecutor

  constructor(
    workspaceId: string,
    documentId: string,
    executor: IFileUploadExecutor
  ) {
    this.workspaceId = workspaceId
    this.documentId = documentId
    this.executor = executor
  }

  public isIdle() {
    return this.executor.isIdle()
  }

  public handleInitialBlockState = (block: Y.XmlElement<FileUploadBlock>) => {
    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
      },
      'handling initial file upload block state'
    )

    const uploadedFiles = block.getAttribute('uploadedFiles')
    if (!uploadedFiles) {
      return
    }

    const files = uploadedFiles.map((file): UploadedFile => {
      return {
        name: file.name,
        size: file.size,
        type: file.type,
        status: 'idle',
        error: file.error,
      }
    })
    if (!equals(files, uploadedFiles)) {
      block.setAttribute('uploadedFiles', files)
    }
  }

  public async handleBlockEvent(
    block: Y.XmlElement<FileUploadBlock>,
    action: string,
    oldValue: any,
    key: string
  ): Promise<void> {
    if (key !== 'uploadedFiles' || action !== 'update') {
      logger().trace(
        {
          workspaceId: this.workspaceId,
          documentId: this.documentId,
          blockId: block.getAttribute('id'),
          action,
          key,
        },
        'ignoring fileupload block event'
      )
      return
    }

    logger().trace(
      {
        workspaceId: this.workspaceId,
        documentId: this.documentId,
        blockId: block.getAttribute('id'),
        action,
        key,
      },
      'handling file upload block event'
    )
    const uploadedFiles = block.getAttribute('uploadedFiles') ?? []
    await this.handleUploadedFilesChange(block, oldValue, uploadedFiles)
  }

  private async handleUploadedFilesChange(
    block: Y.XmlElement<FileUploadBlock>,
    prev: UploadedFile[],
    next: UploadedFile[]
  ) {
    const prevByName = prev.reduce((acc, file) => {
      acc[file.name] = file
      return acc
    }, {} as Record<string, UploadedFile>)

    await Promise.all(
      next.map(async (n) => {
        const p = prevByName[n.name]
        if (!p) {
          return n
        }

        return this.handleUploadedFileChange(block, p, n)
      })
    )
  }

  private async handleUploadedFileChange(
    block: Y.XmlElement<FileUploadBlock>,
    prev: UploadedFile,
    next: UploadedFile
  ): Promise<boolean> {
    switch (next.status) {
      case 'idle':
        return false
      case 'delete-requested':
        switch (prev.status) {
          case 'idle':
          case 'delete-requested':
            updateUploadedFile(block, next.name, { status: 'deleting' })
            return true
          case 'deleting':
            return false
        }
      case 'deleting':
        await this.deleteFile(block, next)
        return true
    }
  }

  private async deleteFile(
    block: Y.XmlElement<FileUploadBlock>,
    f: UploadedFile
  ) {
    try {
      await this.executor.deleteFile(f.name)
      removeUploadedFile(block, f.name)
    } catch (error) {
      updateUploadedFile(block, f.name, {
        status: 'idle',
        error: 'delete-unexpected-error',
      })
    }
  }

  public static make(workspaceId: string, documentId: string) {
    const executor = FileUploadExecutor.make(workspaceId)

    return new FileUploadObserver(workspaceId, documentId, executor)
  }
}
