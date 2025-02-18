import { APIDataSources } from '@/hooks/useDatasources'
import {
  execStatusIsDisabled,
  ExecutionQueue,
  getWritebackAttributes,
  getWritebackBlockExecStatus,
  getWritebackBlockResultStatus,
  type WritebackBlock,
} from '@briefer/editor'
import {
  ArrowUpTrayIcon,
  ClockIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/20/solid'
import clsx from 'clsx'
import { RefObject, useCallback, useMemo } from 'react'
import { ConnectDragPreview } from 'react-dnd'
import * as Y from 'yjs'
import WritebackControls from './WritebackControls'
import { DataFrame } from '@briefer/types'
import WritebackResult from './WritebackResult'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { XCircleIcon } from 'lucide-react'
import { CheckCircleIcon } from '@heroicons/react/24/outline'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { head } from 'ramda'
import { TooltipV2 } from '@/components/Tooltips'

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
  userId: string | null
  executionQueue: ExecutionQueue
  isFullScreen: boolean
}
function WritebackBlock(props: Props) {
  const {
    status: envStatus,
    loading: envLoading,
    startedAt: environmentStartedAt,
  } = useEnvironmentStatus(props.workspaceId)

  const {
    id: blockId,
    title,
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

  const execStatus = getWritebackBlockExecStatus(
    props.block,
    props.executionQueue
  )
  const resultStatus = getWritebackBlockResultStatus(props.block)
  const statusIsDisabled = execStatusIsDisabled(execStatus)

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'writeback'
  )
  const execution = head(executions)
  const status = execution?.item.getStatus()._tag ?? 'idle'
  const onRunAbort = useCallback(() => {
    if (execution) {
      if (execution.item.getStatus()._tag === 'enqueued') {
        execution.batch.removeItem(blockId)
      } else {
        execution.item.setAborting()
      }
    } else {
      props.executionQueue.enqueueBlock(
        blockId,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'writeback',
        }
      )
    }
  }, [
    blockId,
    environmentStartedAt,
    execution,
    props.executionQueue,
    props.userId,
  ])

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

  const isRunButtonDisabled =
    status === 'aborting' || execution?.batch.isRunAll()

  const runTooltipContent = useMemo(() => {
    if (status !== 'idle') {
      switch (status) {
        case 'enqueued':
          return {
            title: 'This block is enqueud',
            message: isRunButtonDisabled
              ? 'When running entire documents, you cannot remove individual blocks from the queue.'
              : 'It will run once the previous blocks finish executing. Click to remove it from the queue.',
          }
        case 'running': {
          if (envStatus !== 'Running' && !envLoading) {
            return {
              title: 'Your environment is starting',
              message:
                'Please hang tight. We need to start your environment before executing writeback.',
            }
          }

          if (execution?.batch.isRunAll() ?? false) {
            return {
              title: 'This block is running.',
              message:
                'When running entire documents, you cannot stop individual blocks.',
            }
          }
        }
        case 'unknown':
        case 'aborting':
        case 'completed':
          return null
      }
    } else {
      return {
        content: (ref: RefObject<HTMLDivElement>) => (
          <div
            className="font-sans pointer-events-none absolute w-max bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1"
            ref={ref}
          >
            <span>Refresh</span>
          </div>
        ),
      }
    }
  }, [status, envStatus, envLoading, execution, isRunButtonDisabled])

  return (
    <div
      className="relative group/block"
      onClick={onClickWithin}
      data-block-id={blockId}
    >
      <div
        className={clsx(
          'rounded-md border',
          props.isBlockHiddenInPublished && 'border-dashed',
          props.hasMultipleTabs ? 'rounded-tl-none' : 'rounded-tl-md',

          props.isCursorWithin ? 'border-blue-400 shadow-sm' : 'border-gray-200'
        )}
      >
        <div
          className={clsx(
            'rounded-md',
            props.hasMultipleTabs ? 'rounded-tl-none' : ''
          )}
        >
          <div
            className="border-b border-gray-200 bg-gray-50 rounded-t-md"
            ref={(d) => {
              props.dragPreview?.(d)
            }}
          >
            <div className="flex items-center justify-between px-3 pr-4 gap-x-4 font-sans h-12 divide-x divide-gray-200">
              <div className="select-none text-gray-300 text-xs flex items-center w-full h-full gap-x-1.5">
                <ArrowUpTrayIcon className="w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  className={clsx(
                    'text-sm font-sans font-medium pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-800 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset py-0 disabled:ring-0 h-2/3 bg-transparent focus:bg-white'
                  )}
                  placeholder="Writeback (click to add a title)"
                  value={title}
                  onChange={onChangeTitle}
                  disabled={!props.isEditable}
                />
                {isCollapsed &&
                  (resultStatus === 'success' ? (
                    <CheckCircleIcon className="w-4 h-4 text-green-600" />
                  ) : (
                    <XCircleIcon className="w-4 h-4 text-red-500" />
                  ))}
              </div>
            </div>
          </div>
        </div>
        <div className={clsx('flex', isCollapsed && 'h-0 overflow-hidden')}>
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
        {/*here*/}
      </div>
      <div
        className={clsx(
          'absolute h-full transition-opacity opacity-0 group-hover/block:opacity-100 pl-1.5 right-0 top-0 translate-x-full flex flex-col gap-y-1 z-20',
          props.isCursorWithin || statusIsDisabled
            ? 'opacity-100'
            : 'opacity-0',
          !props.isEditable ? 'hidden' : 'block'
        )}
      >
        <TooltipV2<HTMLButtonElement> {...runTooltipContent} active={true}>
          {(ref) => (
            <button
              ref={ref}
              onClick={onRunAbort}
              disabled={isRunButtonDisabled}
              className={clsx(
                {
                  'bg-gray-200': isRunButtonDisabled,
                  'bg-red-200': status === 'running' && envStatus === 'Running',
                  'bg-yellow-300':
                    !isRunButtonDisabled &&
                    (status === 'enqueued' ||
                      (status === 'running' && envStatus !== 'Running')),
                  'bg-primary-200': !isRunButtonDisabled && status === 'idle',
                },
                'rounded-sm h-6 min-w-6 flex items-center justify-center relative group disabled:cursor-not-allowed'
              )}
            >
              {status !== 'idle' ? (
                <div>
                  {execStatus === 'enqueued' ? (
                    <ClockIcon className="w-3 h-3 text-gray-500" />
                  ) : (
                    <StopIcon className="w-3 h-3 text-gray-500" />
                  )}
                </div>
              ) : (
                <PlayIcon className="w-3 h-3 text-gray-500" />
              )}
            </button>
          )}
        </TooltipV2>
        <HiddenInPublishedButton
          isBlockHiddenInPublished={props.isBlockHiddenInPublished}
          onToggleIsBlockHiddenInPublished={onToggleIsBlockHiddenInPublished}
          hasMultipleTabs={props.hasMultipleTabs}
          isCodeHidden={false}
          isOutputHidden={false}
        />
      </div>
    </div>
  )
}

export default WritebackBlock
