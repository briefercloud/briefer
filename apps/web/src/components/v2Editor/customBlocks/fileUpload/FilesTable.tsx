import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/20/solid'
import { ArrowDownTrayIcon } from '@heroicons/react/24/solid'
import { InformationCircleIcon, TrashIcon } from '@heroicons/react/24/outline'
import { UploadedFile } from '@briefer/editor'
import { FileUploadState, UploadError } from '.'
import clsx from 'clsx'
import UploadedFileC from './UploadedFile'
import StateFiles from './StateFiles'
import { useCallback, useMemo } from 'react'
import Spin from '@/components/Spin'
import Link from 'next/link'
import { NEXT_PUBLIC_API_URL } from '@/utils/env'

export type FilesTableHeader = 'Name' | 'Type' | 'Size' | 'Usage' | 'DL' | 'Del'
const editorHeaders: FilesTableHeader[] = [
  'Name',
  'Type',
  'Size',
  'Usage',
  'DL',
  'Del',
]
const viewerHeaders: FilesTableHeader[] = ['Name', 'Type', 'Size']
const publicHeaders: FilesTableHeader[] = ['Name', 'Type', 'Size']

interface Props {
  title: string
  onChangeTitle: (title: string) => void
  areFilesHidden: boolean
  toggleFilesHidden: () => void
  workspaceId: string
  documentId: string
  files: UploadedFile[]
  state: FileUploadState
  isEditable: boolean
  isPublicViewer: boolean
  onReplaceYes: () => void
  onReplaceAll: () => void
  onReplaceNo: () => void
  onDownload: (filename: string) => void
  onDelete: (filename: string) => void
  onAbort: (filename: string) => void
  onUpload: () => void
  onPythonUsage: (filename: string, type: string) => void
  onQueryUsage: (filename: string, type: string) => void
  isBlockHiddenInPublished: boolean
}
function FilesTable(props: Props) {
  const isAskingReplace =
    props.state._tag === 'uploading' &&
    props.state.current.status === 'asking-replace'

  const headers = props.isPublicViewer
    ? publicHeaders
    : props.isEditable
    ? editorHeaders
    : viewerHeaders

  const okFiles = props.files.length
  const uploadingFiles =
    props.state._tag === 'uploading' ? props.state.rest.length + 1 : 0
  const errFiles = props.state.errors.length
  const totalFiles = okFiles + uploadingFiles + errFiles

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.onChangeTitle(e.target.value)
    },
    [props.onChangeTitle]
  )

  return (
    <div
      className={clsx(
        isAskingReplace && 'min-h-64',
        props.isBlockHiddenInPublished && 'border-dashed',
        'flow-root bg-white relative border border-gray-200 rounded-md'
      )}
    >
      <div className="bg-gray-50 text-xs py-2 rounded-t-md">
        <div className="flex items-center text-gray-400 hover:text-gray-500 px-3 h-[1.6rem]">
          <button
            className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm mr-0.5"
            onClick={props.toggleFilesHidden}
          >
            {props.areFilesHidden ? <ChevronRightIcon /> : <ChevronDownIcon />}
          </button>
          <input
            type="text"
            className={clsx(
              'w-1/2 font-sans bg-transparent pl-1 ring-gray-200 focus:ring-gray-400 block rounded-md border-0 text-gray-500 hover:ring-1 focus:ring-1 ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs disabled:ring-0 h-full'
            )}
            placeholder="Files"
            value={props.title}
            disabled={!props.isEditable}
            onChange={onChangeTitle}
          />
        </div>
      </div>
      <table
        className={clsx(
          'min-w-full divide-y divide-gray-200 border-t',
          props.areFilesHidden && 'hidden'
        )}
      >
        <thead>
          <tr className="divide-x divide-gray-100">
            {headers.map((header) => (
              <th
                key={header}
                scope="col"
                className="px-2 py-2 text-left text-xs uppercase font-normal text-gray-400"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 max-h-96">
          {props.files.map((file, i) => (
            <UploadedFileC
              key={i}
              file={file}
              downloadLink={`${NEXT_PUBLIC_API_URL()}/v1/workspaces/${
                props.workspaceId
              }/documents/${props.documentId}/files/${encodeURIComponent(
                file.name
              )}`}
              onDelete={props.onDelete}
              headers={headers}
              onPythonUsage={props.onPythonUsage}
              onQueryUsage={props.onQueryUsage}
            />
          ))}
          <StateFiles
            state={props.state}
            headers={headers}
            onAbort={props.onAbort}
          />
        </tbody>
      </table>
      {isAskingReplace && (
        <>
          <div className="absolute top-0 left-0 w-full h-full">
            <div className="bg-white/90 absolute top-0 left-0 w-full h-full" />
            <div className="flex items-center justify-center flex-col gap-y-6 h-full w-full relative">
              <p className="text-gray-600 text-sm">
                File <span className="font-medium">{isAskingReplace}</span>{' '}
                already exists. Do you want to replace it?
              </p>
              <div className="flex justify-center gap-x-4">
                <button
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
                  onClick={props.onReplaceYes}
                >
                  Yes
                </button>
                <button
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
                  onClick={props.onReplaceAll}
                >
                  Yes to all
                </button>
                <button
                  className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800"
                  onClick={props.onReplaceNo}
                >
                  No
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      <div className="flex justify-between bg-gray-50 text-xs text-gray-400 px-3 py-2 border-t border-gray-200 rounded-b-md">
        <div>
          {okFiles} {okFiles < totalFiles ? `out of ${totalFiles} ` : ''}
          {okFiles === 1 ? 'file' : 'files'} uploaded into{' '}
          <span className="font-mono">/home/jupyteruser</span>.{' '}
          {errFiles > 0 && (
            <>
              {errFiles} {errFiles === 1 ? 'error' : 'errors'}.
            </>
          )}
        </div>
        <div className="flex space-x-2">
          <span>
            Drag and drop to{' '}
            <span
              className="underline hover:text-primary-700 cursor-pointer"
              onClick={props.onUpload}
            >
              upload more
            </span>
            .
          </span>
          <div className="relative group/tooltip">
            <InformationCircleIcon className="text-gray-400 hover:text-gray-600 cursor-help w-4 h-4" />
            <div className="font-sans pointer-events-none absolute -top-2 left-1/2 -translate-y-full -translate-x-1/2 opacity-0 transition-opacity group-hover/tooltip:opacity-100 bg-hunter-950 text-xs p-3 rounded-md flex flex-col gap-y-1 font-sans w-64 text-center">
              <span className="text-white">These files are in your disk.</span>
              <span className="text-gray-400">
                Your files are available in your filesystem at
                /home/jupyteruser. Use this path in your Python code to read
                them.
              </span>
            </div>{' '}
          </div>
        </div>
      </div>
    </div>
  )
}

interface RowProps {
  file: CellFile
  headers: FilesTableHeader[]
  downloadLink: string
  isDeleting: boolean
  onDelete: (filename: string) => void
  uploading: boolean
  error: UploadError['reason'] | null
  onPythonUsage: (filename: string) => void
  onQueryUsage: (filename: string) => void
}
export function Row(props: RowProps) {
  return (
    <tr className="divide-x divide-gray-100">
      {props.headers.map((h) => (
        <Cell
          key={props.file.name + h}
          header={h}
          file={props.file}
          isDeleting={props.isDeleting}
          downloadLink={props.downloadLink}
          onDelete={props.onDelete}
          uploading={props.uploading}
          error={props.error}
          onPythonUsage={props.onPythonUsage}
          onQueryUsage={props.onQueryUsage}
        />
      ))}
    </tr>
  )
}

function cellClasses(header: FilesTableHeader): string {
  switch (header) {
    case 'Name':
      return 'w-[43%] font-medium text-gray-600 text-xs overflow-hidden'
    case 'Type':
      return 'w-[18%] text-gray-400 text-xs overflow-hidden'
    case 'Size':
      return 'w-[12%] md:w-[12%] xl:w-[16%] text-gray-400 text-xs overflow-hidden'
    case 'Usage':
      return 'w-[20%] md:w-[18%] xl:w-[16%] font-medium text-gray-600 text-xs overflow-visible'
    case 'DL':
      return 'w-[4%] font-medium text-gray-600 text-xs overflow-visible'
    case 'Del':
      return 'w-[4%] font-medium text-gray-600 text-xs overflow-hidden'
  }
}

export interface CellFile {
  name: string
  type: string
  uploaded: number
  total: number
}

interface CellProps {
  header: FilesTableHeader
  file: CellFile
  uploading: boolean
  downloadLink: string
  isDeleting: boolean
  onDelete: (filename: string) => void
  error: UploadError['reason'] | null
  onPythonUsage: (filename: string) => void
  onQueryUsage: (filename: string) => void
}
export function Cell(props: CellProps) {
  const onPythonUsage = useCallback(() => {
    props.onPythonUsage(props.file.name)
  }, [props.onPythonUsage, props.file])

  const onQueryUsage = useCallback(() => {
    props.onQueryUsage(props.file.name)
  }, [props.onQueryUsage, props.file])

  const onDelete = useCallback(() => {
    props.onDelete(props.file.name)
  }, [props.onDelete, props.file])

  const disabled = props.error !== null || props.uploading

  const inner = useMemo(() => {
    switch (props.header) {
      case 'Name': {
        if (props.error) {
          return (
            <span>
              {props.file.name}{' '}
              <span className="text-red-600">
                {' '}
                ({getErrorMessage(props.error)})
              </span>
            </span>
          )
        }
        return <span>{props.file.name}</span>
      }
      case 'Type':
        return (
          <span className="break-all">
            {props.file.type
              ? props.file.type
              : props.file.name.split('.').pop()}
          </span>
        )
      case 'Size': {
        if (props.uploading) {
          if (props.file.uploaded === props.file.total) {
            return <>Processing...</>
          }

          return (
            <>
              {formatBytes(props.file.uploaded)} (
              {formatBytes(props.file.total)})
            </>
          )
        }

        return <>{formatBytes(props.file.total)}</>
      }
      case 'Usage':
        return (
          <div
            className={clsx(
              'flex items-center justify-left text-gray-400 text-xs space-x-1'
            )}
          >
            <button
              className={clsx(
                'cursor-pointer disabled:cursor-not-allowed hover:text-primary-700',
                !disabled && 'hover:text-gray-500'
              )}
              disabled={disabled}
              onClick={onPythonUsage}
            >
              Python
            </button>
            <span>/</span>
            <button
              className={clsx(
                'cursor-pointer disabled:cursor-not-allowed hover:text-primary-700',
                !disabled && 'hover:text-gray-500'
              )}
              onClick={onQueryUsage}
              disabled={disabled}
            >
              Query
            </button>
          </div>
        )
      case 'DL':
        return (
          <Link
            className={clsx(
              'flex items-center jutify-center text-gray-500 h-4 w-4 text-xs hover:text-gray-700',
              disabled && 'cursor-not-allowed hover:text-gray-400'
            )}
            href={props.downloadLink}
            target="_blank"
          >
            <ArrowDownTrayIcon />
          </Link>
        )
      case 'Del':
        return (
          <button
            className="flex items-center jutify-center cursor-pointer text-gray-500 hover:text-red-600 h-4 w-4 text-xs"
            onClick={onDelete}
            disabled={props.isDeleting}
          >
            {props.isDeleting ? <Spin /> : <TrashIcon />}
          </button>
        )
    }
  }, [
    props.header,
    props.file,
    props.uploading,
    props.downloadLink,
    props.isDeleting,
    props.error,
    disabled,
    onDelete,
    onPythonUsage,
    onQueryUsage,
  ])

  return (
    <td
      key={props.header}
      className={clsx('p-2 max-w-[0px] table-cell', cellClasses(props.header))}
    >
      {inner}
    </td>
  )
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

function getErrorMessage(error: UploadError['reason']) {
  switch (error) {
    case 'file-exists':
      return 'file already exists'
    case 'aborted':
      return 'upload aborted'
    case 'unexpected':
      return 'unexpected error, please try again'
  }
}

export default FilesTable
