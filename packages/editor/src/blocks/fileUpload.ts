import * as Y from 'yjs'
import {
  BaseBlock,
  BlockType,
  duplicateBaseAttributes,
  getAttributeOr,
  getBaseAttributes,
} from './index.js'
import { clone } from 'ramda'

export type UploadedFile = {
  name: string
  size: number
  type: string
  status: 'idle' | 'delete-requested' | 'deleting'
  error: 'delete-unexpected-error' | null
}

export type FileUploadBlock = BaseBlock<BlockType.FileUpload> & {
  uploadedFiles: UploadedFile[]
  areFilesHidden: boolean
}

export const isFileUploadBlock = (
  block: Y.XmlElement<any>
): block is Y.XmlElement<FileUploadBlock> => {
  return block.getAttribute('type') === BlockType.FileUpload
}

export function makeFileUploadBlock(id: string): Y.XmlElement<FileUploadBlock> {
  const block = new Y.XmlElement<FileUploadBlock>('block')

  const attrs: FileUploadBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.FileUpload,
    uploadedFiles: [],
    areFilesHidden: false,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    block.setAttribute(key, value)
  }

  return block
}

export function getFileUploadAttributes(
  block: Y.XmlElement<FileUploadBlock>
): FileUploadBlock {
  return {
    ...getBaseAttributes(block),
    uploadedFiles: getUploadedFiles(block),
    areFilesHidden: getAttributeOr(block, 'areFilesHidden', false),
  }
}

export function duplicateFileUploadBlock(
  newId: string,
  block: Y.XmlElement<FileUploadBlock>
): Y.XmlElement<FileUploadBlock> {
  const prevAttrs = getFileUploadAttributes(block)

  const newAttrs: FileUploadBlock = {
    ...duplicateBaseAttributes(newId, prevAttrs),
    uploadedFiles: clone(prevAttrs.uploadedFiles),
    areFilesHidden: prevAttrs.areFilesHidden,
  }

  const newBlock = makeFileUploadBlock(newId)
  for (const [key, value] of Object.entries(newAttrs)) {
    // @ts-ignore
    newBlock.setAttribute(key, value)
  }

  return newBlock
}

export function getUploadedFiles(
  block: Y.XmlElement<FileUploadBlock>
): UploadedFile[] {
  const uploadedFiles = block.getAttribute('uploadedFiles')
  if (!uploadedFiles) {
    block.setAttribute('uploadedFiles', [])
    return []
  }

  return uploadedFiles
}

export function appendUploadedFile(
  block: Y.XmlElement<FileUploadBlock>,
  name: string,
  size: number,
  type: string
) {
  const operation = () => {
    const uploadedFile: UploadedFile = {
      name,
      size,
      type,
      status: 'idle',
      error: null,
    }
    const uploadedFiles = block.getAttribute('uploadedFiles') ?? []
    block.setAttribute('uploadedFiles', [...uploadedFiles, uploadedFile])
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function requestDelete(
  block: Y.XmlElement<FileUploadBlock>,
  fileName: string
) {
  const operation = () => {
    const uploadedFiles = block.getAttribute('uploadedFiles') ?? []
    block.setAttribute(
      'uploadedFiles',
      uploadedFiles.map((f) => {
        if (f.name === fileName) {
          return {
            ...f,
            status: 'delete-requested',
          }
        }

        return f
      })
    )
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function updateUploadedFile(
  block: Y.XmlElement<FileUploadBlock>,
  fileName: string,
  update: Partial<UploadedFile>
) {
  const operation = () => {
    const uploadedFiles = block.getAttribute('uploadedFiles') ?? []
    block.setAttribute(
      'uploadedFiles',
      uploadedFiles.map((f) => {
        if (f.name === fileName) {
          return {
            ...f,
            ...update,
            name: fileName,
          }
        }

        return f
      })
    )
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function removeUploadedFile(
  block: Y.XmlElement<FileUploadBlock>,
  fileName: string
) {
  const operation = () => {
    const uploadedFiles = block.getAttribute('uploadedFiles') ?? []
    block.setAttribute(
      'uploadedFiles',
      uploadedFiles.filter((f) => f.name !== fileName)
    )
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}
