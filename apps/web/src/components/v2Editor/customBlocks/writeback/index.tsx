import { APIDataSources } from '@/hooks/useDatasources'
import {
  execStatusIsDisabled,
  getWritebackAttributes,
  getWritebackBlockExecStatus,
  type WritebackBlock,
} from '@briefer/editor'
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { useCallback, useMemo } from 'react'
import { ConnectDragPreview } from 'react-dnd'
import * as Y from 'yjs'
import WritebackControls from './WritebackControls'
import { DataFrame } from '@briefer/types'
import WritebackResult from './WritebackResult'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { WritebackExecTooltip } from '../../ExecTooltip'
import { XCircleIcon } from 'lucide-react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import useEditorAwareness from '@/hooks/useEditorAwareness'

interface Props {
  workspaceId: string
  block: Y.XmlElement<WritebackBlock>
  hasMultipleTabs: boolean
  isEditable: boolean
  dragPreview: ConnectDragPreview | null
  dataSources: APIDataSources
  dataframes: Y.Map<DataFrame>
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  isCursorWithin: boolean
  isCursorInserting: boolean
}
function WritebackBlock(props: Props) {
  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.workspaceId
  )

  const {
    id: blockId,
    title,
    status,
    tableName,
    isCollapsed,
    dataframeName,
    onConflict,
    onConflictColumns,
    overwriteTable,
    result,
  } = getWritebackAttributes(props.block)

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.block.setAttribute('title', e.target.value)
    },
    [props.block]
  )

  const toggleCollapsed = useCallback(() => {
    props.block.setAttribute('isCollapsed', !isCollapsed)
  }, [props.block, isCollapsed])

  const onChangeDataSourceId = useCallback(
    (value: string) => props.block.setAttribute('dataSourceId', value),
    [props.block]
  )

  const dataframes = Array.from(props.dataframes.values())
  const dataframe = dataframes.find((df) => df.name === dataframeName) ?? null
  const onChangeDataframe = useCallback(
    (value: DataFrame) => {
      props.block.setAttribute('dataframeName', value.name)
    },
    [props.block]
  )

  const onChangeOverwriteTable = useCallback(
    (value: boolean) => {
      props.block.setAttribute('overwriteTable', value)
    },
    [props.block]
  )

  const onChangeOnConflict = useCallback(
    (value: 'update' | 'ignore') => {
      props.block.setAttribute('onConflict', value)
    },
    [props.block]
  )

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const execStatus = getWritebackBlockExecStatus(props.block)
  const statusIsDisabled = execStatusIsDisabled(execStatus)

  const onRunAbort = useCallback(() => {
    props.block.setAttribute(
      'status',
      status === 'idle' ? 'running' : 'aborting'
    )
  }, [props.block])

  const onChangeOnConflictColumns = useCallback(
    (value: string[]) => {
      props.block.setAttribute('onConflictColumns', value)
    },
    [props.block]
  )

  const [, editorAPI] = useEditorAwareness()
  const onClickWithin = useCallback(() => {
    editorAPI.insert(blockId, { scrollIntoView: false })
  }, [blockId, editorAPI])

  const dataSources = useMemo(
    () => props.dataSources.map((d) => d.config).toArray(),
    [props.dataSources]
  )

  return (
    <div
      className="relative group/block"
      onClick={onClickWithin}
      data-block-id={blockId}
    >
      <div
        className={clsx(
          'rounded-md border',
          'bg-white',
          props.hasMultipleTabs ? 'roudned-tl-none' : 'roudned-tl-md',
          props.isCursorWithin ? 'border-blue-400 shadow-sm' : 'border-gray-200'
        )}
      >
        <div
          className="py-3"
          ref={(d) => {
            props.dragPreview?.(d)
          }}
        >
          <div className="flex items-center justify-between px-3 pr-3 gap-x-4 font-sans h-[1.6rem]">
            <div className="select-none text-gray-300 text-xs flex items-center w-full h-full">
              <button
                className="print:hidden h-4 w-4 hover:text-gray-400 rounded-sm mr-0.5"
                onClick={toggleCollapsed}
              >
                {isCollapsed ? <ChevronRightIcon /> : <ChevronDownIcon />}
              </button>
              <input
                type="text"
                className={clsx(
                  'font-sans pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-500 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs disabled:ring-0 h-full bg-transparent'
                )}
                placeholder="Writeback"
                value={title}
                onChange={onChangeTitle}
                disabled={!props.isEditable}
              />
              {isCollapsed &&
                (execStatus === 'success' ? (
                  <CheckCircleIcon className="w-4 h-4 text-green-600" />
                ) : (
                  <XCircleIcon className="w-4 h-4 text-red-500" />
                ))}
            </div>
          </div>
        </div>
        <div
          className={clsx(
            'flex',
            isCollapsed ? 'h-0 overflow-hidden' : 'border-t border-gray-200'
          )}
        >
          <div
            className={clsx(
              'w-1/3 border-r border-gray-200 h-[372px] overflow-y-auto',
              !result && 'shadow-[2px_0_5px_-4px_#888]'
            )}
          >
            <WritebackControls
              dataSources={props.dataSources}
              dataSourceId={props.block.getAttribute('dataSourceId') || ''}
              onChangeDataSourceId={onChangeDataSourceId}
              tableName={tableName}
              dataframes={dataframes}
              dataframe={dataframe}
              onChangeDataframe={onChangeDataframe}
              overwriteTable={overwriteTable}
              onChangeOverwriteTable={onChangeOverwriteTable}
              onConflict={onConflict}
              onChangeOnConflict={onChangeOnConflict}
              onConflictColumns={onConflictColumns}
              onChangeOnConflictColumns={onChangeOnConflictColumns}
              disabled={statusIsDisabled}
            />
          </div>
          <div className="w-2/3">
            <WritebackResult
              status={execStatus}
              result={result}
              dataSources={dataSources}
            />
          </div>
        </div>
      </div>
      <div className="absolute transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1">
        <button
          onClick={onRunAbort}
          disabled={status !== 'idle' && status !== 'running'}
          className={clsx(
            {
              'bg-gray-200 cursor-not-allowed':
                status !== 'idle' && status !== 'running',
              'bg-red-200': status === 'running' && envStatus === 'Running',
              'bg-yellow-300': status === 'running' && envStatus !== 'Running',
              'bg-primary-200': status === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
        >
          {status !== 'idle' ? (
            <div>
              {execStatus === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <WritebackExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={execStatus === 'enqueued' ? 'enqueued' : 'running'}
                runningAll={
                  status === 'run-all-enqueued' || status === 'run-all-running'
                }
              />
            </div>
          ) : (
            <div>
              <PlayIcon className="w-3 h-3 text-gray-500" />
              <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
                <span>Run writeback</span>
              </div>
            </div>
          )}
        </button>
        <HiddenInPublishedButton
          isBlockHiddenInPublished={props.isBlockHiddenInPublished}
          onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
          hasMultipleTabs={props.hasMultipleTabs}
        />
      </div>
    </div>
  )
}

export default WritebackBlock
