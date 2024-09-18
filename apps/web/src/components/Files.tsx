import * as Y from 'yjs'
import { useDropzone } from 'react-dropzone'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExclamationTriangleIcon,
  ChevronDoubleRightIcon,
  CloudArrowUpIcon,
  DocumentPlusIcon,
  TrashIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Dialog, Transition } from '@headlessui/react'
import { UploadResult, UploadFile, useFiles } from '@/hooks/useFiles'
import { BrieferFile } from '@briefer/types'
import Link from 'next/link'
import Spin from './Spin'
import clsx from 'clsx'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import {
  BlockType,
  addBlockGroup,
  getBlocks,
  getLayout,
  requestRun,
} from '@briefer/editor'
import {
  FolderIcon,
  InformationCircleIcon,
  QuestionMarkCircleIcon,
  CloudArrowUpIcon as CloudArrowUpIconSolid,
} from '@heroicons/react/20/solid'
import { PortalTooltip, Tooltip } from './Tooltips'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

interface Props {
  workspaceId: string
  visible: boolean
  onHide: () => void
  yDoc?: Y.Doc
}
export default function Files(props: Props) {
  const { startedAt: environmentStartedAt } = useEnvironmentStatus(
    props.workspaceId
  )

  const onUseInPython = useCallback(
    (file: BrieferFile) => {
      if (!props.yDoc) {
        return
      }

      const fileExtension =
        file.mimeType === 'application/json'
          ? 'json'
          : file.mimeType === 'text/csv'
          ? 'csv'
          : file.mimeType === 'application/vnd.ms-excel'
          ? 'xls'
          : file.mimeType ===
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          ? 'xlsx'
          : ''

      const source =
        fileExtension !== ''
          ? `import pandas as pd
df = pd.read_${fileExtension}('${file.relCwdPath}')
df`
          : `file = open('${file.relCwdPath}').read()
file`

      const layout = getLayout(props.yDoc)
      const blocks = getBlocks(props.yDoc)
      const blockId = addBlockGroup(
        layout,
        blocks,
        {
          type: BlockType.Python,
          source,
        },
        layout.length
      )

      const pythonBlock = blocks.get(blockId)
      if (!pythonBlock) {
        return
      }

      requestRun(pythonBlock, blocks, layout, environmentStartedAt, false)
    },
    [props.yDoc, environmentStartedAt]
  )

  const onUseInSQL = useCallback(
    (file: BrieferFile) => {
      if (!props.yDoc) {
        return
      }

      const table = file.relCwdPath
        // replace `\` with `\\`
        .replace(/\\/g, '\\\\')
        // replace `'` with `''`
        .replace(/'/g, "''")
        // replace `"` with `\"`
        .replace(/"/g, '\\"')

      const extension = file.name.split('.').pop()
      let source = `SELECT * FROM '${table}' LIMIT 1000000`
      if (extension === 'xlsx') {
        source = `SELECT * FROM st_read('${table}') LIMIT 1000000`
      }

      const layout = getLayout(props.yDoc)
      const blocks = getBlocks(props.yDoc)

      const blockId = addBlockGroup(
        layout,
        blocks,
        {
          type: BlockType.SQL,
          dataSourceId: null,
          isFileDataSource: true,
          source,
        },
        layout.length
      )

      const sqlBlock = blocks.get(blockId)
      if (!sqlBlock) {
        return
      }

      requestRun(sqlBlock, blocks, layout, environmentStartedAt, false)
    },
    [props.yDoc, environmentStartedAt]
  )

  const [
    { files, deleting, upload },
    {
      del,
      onDrop,
      onReplaceYes,
      onReplaceAll,
      onReplaceNo,
      onAbort,
      onRemoveResult,
    },
  ] = useFiles(props.workspaceId, props.visible ? 5000 : 0)

  const onRemove = useCallback(
    (file: BrieferFile) => {
      return del(file.relCwdPath)
    },
    [del]
  )

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    open: openUpload,
  } = useDropzone({
    onDrop,
    noClick: true,
  })

  const isAskingReplace =
    upload._tag === 'uploading' && upload.current.status === 'asking-replace'

  const actualFiles = useMemo(
    () =>
      files.filter((f) => {
        if (upload._tag === 'idle') {
          return true
        }

        if (
          upload.current.file.name === f.relCwdPath &&
          upload.current.status === 'uploading'
        ) {
          return false
        }

        return true
      }),
    [files, upload]
  )

  const results = useMemo(
    () => upload.results.filter((f) => f.outcome !== 'success'),
    [upload.results]
  )

  return (
    <>
      <Transition
        as="div"
        show={props.visible}
        className="top-0 right-0 h-full absolute bg-white z-30"
        enter="transition-transform duration-300"
        enterFrom="transform translate-x-full"
        enterTo="transform translate-x-0"
        leave="transition-transform duration-300"
        leaveFrom="transform translate-x-0"
        leaveTo="transform translate-x-full"
      >
        <input
          id="file-upload"
          className="sr-only"
          type="file"
          {...getInputProps()}
        />
        <button
          className="absolute z-10 top-7 transform rounded-full border border-gray-300 text-gray-400 bg-white hover:bg-gray-100 w-6 h-6 flex justify-center items-center left-0 -translate-x-1/2"
          onClick={props.onHide}
        >
          <ChevronDoubleRightIcon className="w-3 h-3" />
        </button>
        <div
          className="w-[324px] flex flex-col border-l border-gray-200 h-full bg-white"
          {...getRootProps()}
        >
          <div className="flex justify-between border-b p-6 space-x-3">
            <div>
              <h3 className="text-lg font-medium leading-6 text-gray-900 pr-1.5">
                Files
              </h3>
              <p className="text-gray-500 text-sm pt-1">
                {'Click "add" or drop files into this tab to upload them.'}
              </p>
            </div>

            <div>
              <button
                className="flex items-center gap-x-2 rounded-sm bg-primary-200 px-3 py-1 text-sm hover:bg-primary-300 disabled:cursor-not-allowed disabled:bg-gray-200"
                onClick={openUpload}
              >
                <CloudArrowUpIcon className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>
          {(upload._tag === 'uploading' || results.length > 0) && (
            <>
              <div className="relative flex px-4 py-2 text-xs font-medium border-b bg-gray-50 text-gray-600 justify-between">
                <div className="flex gap-x-1">
                  <CloudArrowUpIconSolid className="w-4 h-4 text-gray-400" />
                  Uploading
                </div>
              </div>
              <ul
                role="list"
                className="divide-y divide-solid overflow-y-scroll border-b"
              >
                {results.map((result, i) => (
                  <li>
                    <UploadResultItem
                      key={i}
                      result={result}
                      onRemove={onRemoveResult}
                    />
                  </li>
                ))}
                {upload._tag === 'uploading' && (
                  <li>
                    <UploadingItem upload={upload.current} onAbort={onAbort} />
                  </li>
                )}
                {upload._tag === 'uploading' &&
                  upload.rest.map((f, i) => (
                    <li key={i}>
                      <WaitingItem file={f} onAbort={onAbort} />
                    </li>
                  ))}
              </ul>
            </>
          )}
          {(actualFiles.length > 0 || upload._tag === 'idle') && (
            <>
              <div className="relative flex px-4 py-2 text-xs font-medium border-b bg-gray-50 text-gray-600 justify-between">
                <div className="flex gap-x-1">
                  <FolderIcon className="w-4 h-4 text-gray-400" />
                  <span className="font-mono">/home/jupyteruser</span>
                </div>
                <Tooltip
                  title=""
                  message="Files will be uploaded to this location. You can read them from disk."
                  position="left"
                  active={true}
                  tooltipClassname="w-44"
                >
                  <InformationCircleIcon className="w-4 h-4 text-gray-300" />
                </Tooltip>
              </div>
              {actualFiles.length > 0 ? (
                <ul
                  role="list"
                  className="flex-1 divide-y divide-solid overflow-y-scroll"
                >
                  {actualFiles
                    .filter((f) => !f.isDirectory)
                    .map((file) => (
                      <li key={file.path}>
                        <FileItem
                          workspaceId={props.workspaceId}
                          file={file}
                          onUseInPython={onUseInPython}
                          onUseInSQL={onUseInSQL}
                          onDelete={onRemove}
                          isDeleting={deleting[file.path]}
                          canUse={props.yDoc !== undefined}
                        />
                      </li>
                    ))}
                </ul>
              ) : (
                !isDragActive && (
                  <div className="flex-1 p-4">
                    <div className="flex items-center justify-center h-full text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
                      Drag and drop files here to upload them.
                    </div>
                  </div>
                )
              )}
              <DragOverlay isDragActive={isDragActive} />
            </>
          )}
        </div>
      </Transition>
      <ReplaceDialog
        fileName={upload._tag === 'uploading' ? upload.current.file.name : ''}
        open={isAskingReplace}
        onReplaceYes={onReplaceYes}
        onReplaceAll={onReplaceAll}
        onReplaceNo={onReplaceNo}
      />
    </>
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
      <div className="absolute top-0 left-0 h-full w-full bg-gray-100 opacity-70" />
      <div className="flex flex-col items-center justify-center gap-y-2 rounded-md bg-gray-50 p-4 relative border-2 border-dashed border-gray-300">
        <DocumentPlusIcon className="w-10 h-10 text-gray-600" />
        <span className="text-center text-gray-600 font-semibold text-xs">
          Drop files here to upload
        </span>
      </div>
    </div>
  )
}

interface UploadResultItemProps {
  result: UploadResult
  onRemove: (file: File) => void
}
function UploadResultItem(props: UploadResultItemProps) {
  const message: string = useMemo(() => {
    switch (props.result.outcome) {
      case 'aborted':
        return 'Upload aborted'
      case 'file-exists':
        return 'File already exists'
      case 'unexpected':
        return 'An unexpected error occurred'
      case 'success':
        return 'Upload successful'
    }
  }, [props.result.outcome])

  const onRemove = useCallback(() => {
    props.onRemove(props.result.file)
  }, [props.onRemove, props.result.file])

  return (
    <div className="px-4 py-2 font-sans">
      <div>
        <div className="flex justify-between pb-1">
          <div
            className="font-medium pr-2 text-sm break-all"
            title={props.result.file.name}
          >
            {props.result.file.name}
          </div>
          <div>
            <button
              className="text-gray-500 disabled:cursor-not-allowed text-xs hover:text-gray-400"
              onClick={onRemove}
            >
              ok
            </button>
          </div>
        </div>
        <div className="font-medium text-gray-400 text-xs">{message}</div>
      </div>
    </div>
  )
}

interface FileItemProps {
  workspaceId: string
  file: BrieferFile
  onUseInPython: (file: BrieferFile) => void
  onUseInSQL: (file: BrieferFile) => void
  onDelete: (file: BrieferFile) => Promise<void>
  isDeleting: boolean
  canUse: boolean
}
function FileItem(props: FileItemProps) {
  const onUseInPython = useCallback(() => {
    props.onUseInPython(props.file)
  }, [props.onUseInPython, props.file])

  const onUseInSQL = useCallback(() => {
    props.onUseInSQL(props.file)
  }, [props.onUseInSQL, props.file])

  const [isDeleting, setIsDeleting] = useState(false)

  const onRemove = useCallback(async () => {
    setIsDeleting(true)
    await props.onDelete(props.file)
    setIsDeleting(false)
  }, [props.onDelete, props.file])

  return (
    <div className="px-4 py-3 font-sans">
      <div>
        <div className="flex justify-between pb-0.5">
          <div
            className="font-medium pr-2 text-sm break-all"
            title={props.file.name}
          >
            {props.file.name}
          </div>
          <div>
            <button
              className="text-gray-500 hover:text-red-500 disabled:cursor-not-allowed"
              onClick={onRemove}
              disabled={props.isDeleting}
            >
              {isDeleting ? <Spin /> : <TrashIcon className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-x-2 font-medium text-gray-400 text-xs">
          {formatBytes(props.file.size)}
          <svg viewBox="0 0 2 2" className="h-0.5 w-0.5 fill-current">
            <circle cx={1} cy={1} r={1} />
          </svg>
          {props.file.mimeType ?? 'unknown'}
        </div>
      </div>
      <div className="flex pt-3 text-xs font-medium">
        <Tooltip
          position="manual"
          title=""
          message="You must be in a notebook to use this file."
          active={!props.canUse}
          tooltipClassname="-top-1 w-44 -translate-y-full"
        >
          <button
            className="text-gray-500 hover:text-gray-400 disabled:hover:text-gray-500 disabled:cursor-not-allowed"
            onClick={onUseInPython}
            disabled={props.isDeleting || !props.canUse}
          >
            Use in Python
          </button>
        </Tooltip>
        <span className="text-gray-300 px-1">/</span>
        <Tooltip
          title=""
          message="You must be in a notebook to use this file."
          active={!props.canUse}
          tooltipClassname="w-44"
        >
          <button
            className="text-gray-500 hover:text-gray-400 disabled:hover:text-gray-500 disabled:cursor-not-allowed"
            onClick={onUseInSQL}
            disabled={props.isDeleting || !props.canUse}
          >
            Query in SQL
          </button>
        </Tooltip>
        <span className="text-gray-300 px-1">/</span>
        <div
          className={clsx(
            'text-gray-500',
            props.isDeleting ? 'cursor-not-allowed' : 'hover:text-gray-400'
          )}
        >
          {props.isDeleting ? (
            'Download'
          ) : (
            <Link
              href={`${NEXT_PUBLIC_API_URL()}/v1/workspaces/${
                props.workspaceId
              }/files/file?path=${encodeURIComponent(props.file.relCwdPath)}`}
              target="_blank"
            >
              Download
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

interface UploadingItemProps {
  upload: UploadFile
  onAbort: (f: File) => void
}
function UploadingItem(props: UploadingItemProps) {
  const onAbort = useCallback(() => {
    props.onAbort(props.upload.file)
  }, [props.onAbort, props.upload.file])

  return (
    <div className="px-4 py-3 font-sans">
      <div>
        <div className="flex items-center justify-between pb-1">
          <div
            className="font-medium pr-2 text-sm break-all"
            title={props.upload.file.name}
          >
            {props.upload.file.name}
          </div>
          <button
            className="text-gray-500 hover:text-red-500 disabled:cursor-not-allowed text-xs"
            onClick={onAbort}
            disabled={props.upload.status !== 'uploading'}
          >
            abort
          </button>
        </div>
        <div className="flex items-center gap-x-2 font-medium text-gray-400 text-xs">
          {formatBytes(props.upload.uploaded)} /{' '}
          {formatBytes(props.upload.file.size)}
        </div>
      </div>
    </div>
  )
}

interface WaitingItemProps {
  file: File
  onAbort: (f: File) => void
}
function WaitingItem(props: WaitingItemProps) {
  const onAbort = useCallback(() => {
    props.onAbort(props.file)
  }, [props.onAbort, props.file])

  return (
    <div className="px-4 py-3 font-sans">
      <div>
        <div className="flex items-center justify-between pb-1">
          <div className="font-medium pr-2 text-sm break-all">
            {props.file.name}
          </div>
          <button
            className="text-gray-500 hover:text-red-500 disabled:cursor-not-allowed text-xs"
            onClick={onAbort}
          >
            abort
          </button>
        </div>
        <div className="flex items-center gap-x-2 font-medium text-gray-400 text-xs">
          {formatBytes(0)} / {formatBytes(props.file.size)}
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['bytes', 'kb', 'mb', 'gb', 'tb', 'pb', 'eb', 'zb', 'yb']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + sizes[i]
}

interface ReplaceDialogProps {
  fileName: string
  open: boolean
  onReplaceYes: () => void
  onReplaceAll: () => void
  onReplaceNo: () => void
}

function ReplaceDialog(props: ReplaceDialogProps) {
  const [fileName, setFileName] = useState(props.fileName)
  useEffect(() => {
    if (props.fileName !== '' && props.fileName !== fileName) {
      setFileName(props.fileName)
    }
  }, [props.fileName])
  return (
    <Transition show={props.open}>
      <Dialog onClose={props.onReplaceNo} className="relative z-[100]">
        <Transition.Child
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all data-[closed]:translate-y-4 data-[closed]:opacity-0 data-[enter]:duration-300 data-[leave]:duration-200 data-[enter]:ease-out data-[leave]:ease-in sm:my-8 sm:w-full sm:max-w-lg sm:p-6 data-[closed]:sm:translate-y-0 data-[closed]:sm:scale-95">
                <div>
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                    <ExclamationTriangleIcon
                      aria-hidden="true"
                      className="h-6 w-6 text-yellow-600"
                    />
                  </div>
                  <div className="mt-3 text-center sm:mt-5">
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        File{' '}
                        <span className="font-mono bg-gray-100 px-1">
                          {fileName}
                        </span>{' '}
                        already exists. Do you want to replace it?
                      </p>
                    </div>
                  </div>
                </div>
                <div className="mt-5 sm:mt-6 sm:grid sm:grid-flow-row-dense sm:grid-cols-3 sm:gap-3">
                  <button
                    type="button"
                    onClick={props.onReplaceYes}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-1 sm:mt-0"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={props.onReplaceAll}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-2 sm:mt-0"
                  >
                    Yes to all
                  </button>
                  <button
                    type="button"
                    data-autofocus
                    onClick={props.onReplaceNo}
                    className="mt-3 inline-flex w-full justify-center rounded-sm bg-white px-3 py-2 text-sm text-gray-700 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 sm:col-start-3 sm:mt-0"
                  >
                    No
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  )
}
