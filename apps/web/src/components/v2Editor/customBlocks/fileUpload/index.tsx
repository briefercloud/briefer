import { DocumentPlusIcon } from '@heroicons/react/24/outline'
import * as Y from 'yjs'
import {
  appendUploadedFile,
  getBaseAttributes,
  getFileUploadAttributes,
  getUploadedFiles,
  requestDelete,
  setTitle,
  type FileUploadBlock,
} from '@briefer/editor'
import { useDropzone } from 'react-dropzone'
import { useCallback, useEffect, useState } from 'react'
import clsx from 'clsx'
import axios from 'axios'
import FilesTable from './FilesTable'
import { uniqBy } from 'ramda'
import { useYElementMemo } from '@/hooks/useYMemo'
import { ConnectDragPreview } from 'react-dnd'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

type UploadFile = {
  status: 'enqueued' | 'uploading' | 'asking-replace'
  replace: boolean
  file: File
  abortController: AbortController
  uploaded: number
  total: number
}

export type UploadError = {
  reason: 'unexpected' | 'file-exists' | 'aborted'
  file: File
}

export type UploadingFileUploadState = {
  _tag: 'uploading'
  errors: UploadError[]
  current: UploadFile
  rest: File[]
  replaceAll: boolean
}

export type FileUploadState =
  | UploadingFileUploadState
  | {
      _tag: 'idle'
      errors: UploadError[]
    }

interface Props {
  block: Y.XmlElement<FileUploadBlock>
  workspaceId: string
  documentId: string
  isEditable: boolean
  isPublicViewer: boolean
  dragPreview: ConnectDragPreview | null
  hasMultipleTabs: boolean
  onPythonUsage: (filename: string, type: string) => void
  onQueryUsage: (filename: string, type: string) => void
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  isCursorWithin: boolean
  isCursorInserting: boolean
}
function FileUploadBlock(props: Props) {
  const [state, setState] = useState<FileUploadState>({
    _tag: 'idle',
    errors: [],
  })

  const onReplaceYes = useCallback(() => {
    setState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return s
      }

      return {
        ...s,
        current: {
          ...s.current,
          replace: true,
          status: 'enqueued',
        },
      }
    })
  }, [])

  const onReplaceAll = useCallback(() => {
    setState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return {
          ...s,
          replaceAll: true,
        }
      }

      return {
        ...s,
        current: {
          ...s.current,
          replace: true,
          status: 'enqueued',
        },
        replaceAll: true,
      }
    })
  }, [])

  const onReplaceNo = useCallback(() => {
    setState((s) => {
      if (s._tag !== 'uploading') {
        return s
      }

      if (s.current.status !== 'asking-replace') {
        return s
      }

      const [next, ...rest] = s.rest
      if (!next) {
        return {
          _tag: 'idle',
          errors: [
            ...s.errors,
            {
              reason: 'file-exists',
              file: s.current.file,
            },
          ],
        }
      }

      return {
        ...s,
        errors: [
          ...s.errors,
          {
            reason: 'file-exists',
            file: s.current.file,
          },
        ],
        current: {
          status: 'enqueued',
          replace: false,
          file: next,
          abortController: new AbortController(),
          uploaded: 0,
          total: next.size,
        },
        rest,
      }
    })
  }, [])

  useEffect(() => {
    if (state._tag !== 'uploading') {
      return
    }

    if (state.current.status === 'asking-replace') {
      return
    }

    if (state.current.status === 'uploading') {
      return
    }

    setState({
      ...state,
      current: {
        ...state.current,
        status: 'uploading',
      },
    })

    const replace = state.current.replace || state.replaceAll
    const url = `${NEXT_PUBLIC_API_URL()}/v1/workspaces/${
      props.workspaceId
    }/documents/${props.documentId}/files?replace=${replace}`
    axios({
      signal: state.current.abortController.signal,
      url,
      method: 'POST',
      withCredentials: true,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-File-Name': state.current.file.name,
        'X-File-Size': state.current.file.size.toString(),
      },
      data: state.current.file,
      onUploadProgress: (e) => {
        setState((s) => {
          if (s._tag !== 'uploading') {
            return s
          }

          if (s.current.status !== 'uploading') {
            return s
          }

          return {
            ...s,
            current: {
              ...s.current,
              uploaded: e.loaded,
            },
          }
        })
      },
    })
      .then(async (res) => {
        if (res.status === 204) {
          appendUploadedFile(
            props.block,
            state.current.file.name,
            state.current.file.size,
            state.current.file.type
          )

          setState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                errors: s.errors,
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
            }
          })
        } else {
          setState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              errors: [
                ...s.errors,
                {
                  reason: 'unexpected',
                  file: s.current.file,
                },
              ],
            }
          })
        }
      })
      .catch((err) => {
        const errorStatus = err.response?.status ?? 500
        if (errorStatus === 409) {
          setState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            return {
              ...s,
              current: {
                ...s.current,
                status: 'asking-replace',
              },
            }
          })
        } else if (err.name === 'CanceledError') {
          setState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                errors: [
                  ...s.errors,
                  {
                    file: s.current.file,
                    reason: 'aborted',
                  },
                ],
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              errors: [
                ...s.errors,
                {
                  reason: 'aborted',
                  file: s.current.file,
                },
              ],
            }
          })
        } else {
          setState((s) => {
            if (s._tag !== 'uploading') {
              return s
            }

            if (s.current.status !== 'uploading') {
              return s
            }

            const [next, ...rest] = s.rest
            if (!next) {
              return {
                _tag: 'idle',
                errors: [
                  ...s.errors,
                  {
                    reason: 'unexpected',
                    file: s.current.file,
                  },
                ],
              }
            }

            return {
              ...s,
              current: {
                file: next,
                abortController: new AbortController(),
                uploaded: 0,
                total: next.size,
                status: 'enqueued',
                replace: false,
              },
              rest,
              errors: [
                ...s.errors,
                {
                  reason: 'unexpected',
                  file: s.current.file,
                },
              ],
            }
          })
        }
      })
  }, [state])

  const onDrop = useCallback(
    (files: File[]) => {
      files = uniqBy((f) => f.name, files)
      const [first, ...rest] = files
      if (!first) {
        return
      }

      setState((s) => {
        switch (s._tag) {
          case 'idle':
            return {
              _tag: 'uploading',
              current: {
                status: 'enqueued',
                file: first,
                abortController: new AbortController(),
                uploaded: 0,
                total: first.size,
                replace: false,
              },
              rest,
              errors: [],
              replaceAll: false,
            }
          case 'uploading':
            return {
              ...s,
              rest: [...s.rest, first, ...files],
            }
        }
      })

      props.block.setAttribute('areFilesHidden', false)
    },
    [props.block]
  )

  const fileEntries = useYElementMemo(getUploadedFiles, props.block, [])

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop,
    noDrag: state._tag === 'uploading',
    noClick: state._tag === 'uploading' || fileEntries.length > 0,
  })

  const onDownload = useCallback((filename: string) => {
    console.log('download', filename)
  }, [])

  const onDelete = useCallback(
    (filename: string) => {
      requestDelete(props.block, filename)
    },
    [props.block]
  )

  const onAbort = useCallback((filename: string) => {
    setState((s) => {
      if (s._tag !== 'uploading') {
        return {
          ...s,
          errors: s.errors.filter((e) => e.file.name !== filename),
        }
      }

      if (s.current.file.name === filename) {
        s.current.abortController.abort()
        return s
      }

      const aborted = s.rest.find((f) => f.name === filename)
      if (!aborted) {
        return s
      }

      return {
        ...s,
        errors: [
          ...s.errors,
          {
            reason: 'aborted',
            file: aborted,
          },
        ],
        rest: s.rest.filter((f) => f.name !== filename),
      }
    })
  }, [])

  const rootProps = getRootProps()
  useEffect(() => {
    if (props.dragPreview) {
      props.dragPreview(rootProps.ref)
    }
  }, [rootProps])

  const { title } = getBaseAttributes(props.block)
  const onChangeTitle = useCallback(
    (title: string) => {
      setTitle(props.block, title)
    },
    [props.block]
  )

  const { areFilesHidden } = getFileUploadAttributes(props.block)
  const toggleFilesHidden = useCallback(() => {
    props.block.setAttribute('areFilesHidden', !areFilesHidden)
  }, [props.block, areFilesHidden])

  const blockId = getBaseAttributes(props.block).id
  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const showTable =
    fileEntries.length > 0 ||
    state.errors.length > 0 ||
    state._tag === 'uploading'

  return (
    <div
      className="group/block relative"
      {...rootProps}
      data-block-id={blockId}
    >
      {showTable ? (
        <FilesTable
          title={title}
          onChangeTitle={onChangeTitle}
          areFilesHidden={areFilesHidden}
          toggleFilesHidden={toggleFilesHidden}
          workspaceId={props.workspaceId}
          documentId={props.documentId}
          files={fileEntries}
          state={state}
          isEditable={props.isEditable}
          isPublicViewer={props.isPublicViewer}
          onReplaceYes={onReplaceYes}
          onReplaceAll={onReplaceAll}
          onReplaceNo={onReplaceNo}
          onDownload={onDownload}
          onDelete={onDelete}
          onAbort={onAbort}
          onUpload={open}
          onPythonUsage={props.onPythonUsage}
          onQueryUsage={props.onQueryUsage}
          isBlockHiddenInPublished={props.isBlockHiddenInPublished}
        />
      ) : (
        <div
          className={clsx(
            'rounded-md',
            props.hasMultipleTabs ? 'p-2 border rounded-tl-none' : '',
            props.isCursorWithin && !props.isCursorInserting
              ? 'border-blue-400 shadow-sm'
              : 'border-gray-200'
          )}
        >
          <EmptyUploadZone isDragActive={isDragActive} />
        </div>
      )}
      <input
        id="file-upload"
        className="sr-only"
        type="file"
        {...getInputProps()}
      />
      <DragOverlay isDragActive={isDragActive} />

      {showTable && (
        <div
          className={clsx(
            'absolute h-full transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1',
            !props.isEditable ? 'hidden' : 'block'
          )}
        >
          <HiddenInPublishedButton
            isBlockHiddenInPublished={props.isBlockHiddenInPublished}
            onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
            hasMultipleTabs={props.hasMultipleTabs}
          />
        </div>
      )}
    </div>
  )
}

function EmptyUploadZone({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div
      className={clsx(
        isDragActive ? 'bg-primary-100 border-primary-600' : '',

        'border-dashed border-gray-900/25 min-h-[10rem] flex items-center justify-center rounded-md border cursor-pointer'
      )}
    >
      <div className="w-full h-full">
        <div className="text-center">
          <DocumentPlusIcon
            className="mx-auto h-10 w-10 text-gray-300"
            aria-hidden="true"
          />
          <div className="pt-2 flex items-center justify-center text-xs leading-6 text-gray-600">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer font-semibold text-primary-600 focus-within:outline-none focus-within:ring-0 hover:text-primary-500"
            >
              <span>Upload files</span>
            </label>
          </div>
          <span className="text-xs pl-1 text-gray-400">
            or drag and drop here
          </span>
        </div>
      </div>
    </div>
  )
}

function DragOverlay({ isDragActive }: { isDragActive: boolean }) {
  return (
    <div
      className={clsx(
        isDragActive ? 'visible' : 'hidden',
        'absolute top-0 left-0 w-full h-full flex items-center justify-center'
      )}
    >
      <div className="absolute top-0 left-0 h-full w-full bg-primary-100 opacity-40" />
      <div className="flex flex-col items-center justify-center gap-y-2 rounded-md bg-white p-4 relative border-2 border-dashed border-gray-300">
        <DocumentPlusIcon className="w-10 h-10 text-primary-600" />
        <span className="text-center text-primary-600 font-semibold text-xs">
          Drop files here to upload
        </span>
      </div>
    </div>
  )
}

export default FileUploadBlock
