import { ConnectDragPreview } from 'react-dnd'
import * as Y from 'yjs'
import { DataFrame, PivotTableSort } from '@briefer/types'
import {
  BlockType,
  ExecutionQueue,
  PivotTableColumn,
  PivotTableMetric,
  PivotTableRow,
  YBlock,
  execStatusIsDisabled,
  getDataframe,
  getPivotTableAttributes,
  getPivotTableBlockExecStatus,
  isExecutionStatusLoading,
  type PivotTableBlock,
} from '@briefer/editor'
import clsx from 'clsx'
import {
  CSSProperties,
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import HeaderSelect from '@/components/HeaderSelect'
import PivotTableControls from './PivotTableControls'
import PivotTableView from './PivotTableView'
import { equals, head } from 'ramda'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import { ClockIcon, PlayIcon, StopIcon } from '@heroicons/react/20/solid'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import LargeSpinner from '@/components/LargeSpinner'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { TableCellsIcon } from '@heroicons/react/24/solid'
import { TooltipV2 } from '@/components/Tooltips'

interface Props {
  workspaceId: string
  dataframes: Y.Map<DataFrame>
  block: Y.XmlElement<PivotTableBlock>
  blocks: Y.Map<YBlock>
  dragPreview: ConnectDragPreview | null
  isEditable: boolean
  onAddGroupedBlock: (
    blockId: string,
    blockType: BlockType,
    position: 'before' | 'after'
  ) => void
  hasMultipleTabs: boolean
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  dashboardMode: 'live' | 'editing' | 'none'
  isCursorWithin: boolean
  isCursorInserting: boolean
  userId: string | null
  executionQueue: ExecutionQueue
  isFullScreen: boolean
}
function PivotTableBlock(props: Props) {
  const attrs = getPivotTableAttributes(props.block, props.blocks)

  const dataframe = getDataframe(props.block, props.dataframes)

  const [isDirty, setIsDirty] = useState(false)
  useEffect(() => {
    if (!dataframe) {
      return
    }

    let timeout: NodeJS.Timeout | null = null
    function observe(event: Y.YXmlEvent) {
      const attrs = getPivotTableAttributes(props.block, props.blocks)
      let shouldBeDirty = false
      if (event.attributesChanged.has('dataframeName')) {
        shouldBeDirty = true
      } else if (event.attributesChanged.has('rows')) {
        const rows = attrs.rows
          .map((row) => row.column?.name?.toString())
          .filter((col): col is string => col !== undefined)
        const resultRows = attrs.result?.pivotRows ?? []

        if (!equals(rows, resultRows)) {
          shouldBeDirty = true
        }
      } else if (event.attributesChanged.has('columns')) {
        const columns = attrs.columns
          .map((col) => col.column?.name?.toString())
          .filter((col): col is string => col !== undefined)
        const resultColumns = attrs.result?.pivotColumns ?? []

        if (!equals(columns, resultColumns)) {
          shouldBeDirty = true
        }
      } else if (event.attributesChanged.has('metrics')) {
        const keyChange = event.keys.get('metrics')
        const oldValue = keyChange?.oldValue as PivotTableMetric[]
        const newValue = attrs.metrics

        const oldNonNull = oldValue.reduce((acc, metric) => {
          if (metric.column) {
            acc.push(metric)
          }
          return acc
        }, [] as PivotTableMetric[])

        const newNonNull = newValue.reduce((acc, metric) => {
          if (metric.column) {
            acc.push(metric)
          }
          return acc
        }, [] as PivotTableMetric[])

        if (!equals(oldNonNull, newNonNull)) {
          shouldBeDirty = true
        }
      }

      if (shouldBeDirty) {
        if (timeout) {
          clearTimeout(timeout)
        }

        timeout = setTimeout(() => {
          setIsDirty(true)
        }, 1000)
      }
    }
    props.block.observe(observe)

    return () => {
      if (timeout) {
        clearTimeout(timeout)
      }

      props.block.unobserve(observe)
    }
  }, [props.block, dataframe])

  const {
    status: envStatus,
    loading: envLoading,
    startedAt: environmentStartedAt,
  } = useEnvironmentStatus(props.workspaceId)

  useEffect(() => {
    if (isDirty) {
      props.executionQueue.enqueueBlock(
        props.block,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'pivot-table',
        }
      )
      setIsDirty(false)
    }
  }, [
    isDirty,
    props.block,
    props.executionQueue,
    props.userId,
    environmentStartedAt,
  ])

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.block.setAttribute('title', e.target.value)
    },
    [props.block]
  )

  const onChangeDataframe = useCallback(
    (dfName: string) => {
      const df = props.dataframes.get(dfName)
      if (df) {
        props.block.setAttribute('dataframeName', dfName)
      }
    },
    [props.block, props.dataframes]
  )

  const dataframeOptions = Array.from(props.dataframes.values()).map((df) => ({
    value: df.name,
    label: df.name,
  }))

  const onNewSQL = useCallback(() => {
    props.onAddGroupedBlock(attrs.id, BlockType.SQL, 'before')
  }, [attrs.id, props.onAddGroupedBlock])

  const onChangeRows = useCallback(
    (rows: PivotTableRow[]) => {
      props.block.setAttribute('rows', rows)
    },
    [props.block]
  )

  const onChangeColumns = useCallback(
    (columns: PivotTableColumn[]) => {
      props.block.setAttribute('columns', columns)
    },
    [props.block]
  )

  const onChangeMetrics = useCallback(
    (metrics: PivotTableMetric[]) => {
      props.block.setAttribute('metrics', metrics)
    },
    [props.block]
  )

  const onToggleControlsHidden = useCallback(() => {
    props.block.setAttribute('controlsHidden', !attrs.controlsHidden)
  }, [props.block, attrs.controlsHidden])

  const onPrevPage = useCallback(() => {
    const run = () => {
      props.block.setAttribute('page', attrs.page - 1)
      props.executionQueue.enqueueBlock(
        props.block,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'pivot-table-load-page',
        }
      )
    }
    if (props.block.doc) {
      props.block.doc.transact(run)
    } else {
      run()
    }
  }, [
    props.block,
    attrs.page,
    props.executionQueue,
    props.userId,
    environmentStartedAt,
  ])

  const onNextPage = useCallback(() => {
    const run = () => {
      props.block.setAttribute('page', attrs.page + 1)
      props.executionQueue.enqueueBlock(
        props.block,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'pivot-table-load-page',
        }
      )
    }
    if (props.block.doc) {
      props.block.doc.transact(run)
    } else {
      run()
    }
  }, [props.block, attrs.page, props.executionQueue, props.userId])

  const setPage = useCallback(
    (page: number) => {
      const run = () => {
        props.block.setAttribute('page', page + 1)
        props.executionQueue.enqueueBlock(
          props.block,
          props.userId,
          environmentStartedAt,
          {
            _tag: 'pivot-table-load-page',
          }
        )
      }

      if (props.block.doc) {
        props.block.doc.transact(run)
      } else {
        run()
      }
    },
    [props.block, props.executionQueue, props.userId]
  )

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'pivot-table'
  )
  const execution = head(executions)
  const status = execution?.item.getStatus()._tag ?? 'idle'

  const pageExecutions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'pivot-table-load-page'
  )
  const pageExecution = head(pageExecutions)
  const pageStatus = pageExecution?.item.getStatus()._tag ?? 'idle'

  const loadingTable = isExecutionStatusLoading(pageStatus)
  const loadingPage = isExecutionStatusLoading(status)

  const isEditable =
    props.isEditable &&
    execution?.batch.isRunAll() !== true &&
    pageExecution?.batch.isRunAll() !== true

  // TODO: should introduce a useBlockExecutionStatus hook
  const execStatus = getPivotTableBlockExecStatus(
    props.block,
    props.executionQueue
  )

  const onRunAbort = useCallback(() => {
    if (execution || pageExecution) {
      if (execution) {
        execution.item.setAborting()
      }
      if (pageExecution) {
        pageExecution.item.setAborting()
      }
    } else {
      props.executionQueue.enqueueBlock(
        props.block,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'pivot-table',
        }
      )
    }
  }, [
    execution,
    pageExecution,
    props.executionQueue,
    props.block,
    props.userId,
    environmentStartedAt,
  ])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(attrs.id)
  }, [props.onToggleIsBlockHiddenInPublished, attrs.id])

  const onSort = useCallback(
    (sort: PivotTableSort | null) => {
      props.block.setAttribute('sort', sort)
      props.executionQueue.enqueueBlock(
        props.block,
        props.userId,
        environmentStartedAt,
        {
          _tag: 'pivot-table',
        }
      )
    },
    [props.block, props.executionQueue, props.userId, props.executionQueue]
  )

  const [, editorAPI] = useEditorAwareness()
  const onClickWithin = useCallback(() => {
    editorAPI.insert(attrs.id, { scrollIntoView: false })
  }, [attrs.id, editorAPI.insert])

  const runTooltipContent = useMemo(() => {
    if (status !== 'idle') {
      switch (status) {
        case 'enqueued':
          return {
            title: 'This block is enqueud',
            message: 'It will run once the previous blocks finish executing.',
          }
        case 'running': {
          if (envStatus !== 'Running' && !envLoading) {
            return {
              title: 'Your environment is starting',
              message:
                'Please hang tight. We need to start your environment before rendering the pivot table.',
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
            className="font-sans pointer-events-none w-max bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1"
            ref={ref}
          >
            <span>Refresh</span>
          </div>
        ),
      }
    }
  }, [status, envStatus, envLoading, execution])

  if (props.dashboardMode !== 'none') {
    if (!attrs.result) {
      return (
        <div className="flex items-center justify-center h-full">
          {isExecutionStatusLoading(execStatus) ? (
            <LargeSpinner color="#b8f229" />
          ) : (
            <div className="text-gray-500">No query results</div>
          )}
        </div>
      )
    }

    return (
      <PivotTableView
        pivotRows={attrs.rows}
        pivotColumns={attrs.columns}
        pivotMetrics={attrs.metrics}
        result={attrs.result}
        page={attrs.page}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
        setPage={setPage}
        error={attrs.error}
        loadingTable={loadingTable}
        loadingPage={loadingPage}
        dataframe={dataframe}
        onNewSQL={onNewSQL}
        controlsHidden={attrs.controlsHidden}
        onToggleControlsHidden={onToggleControlsHidden}
        dashboardMode={props.dashboardMode}
        isEditable={isEditable}
        sort={attrs.sort}
        onSort={onSort}
      />
    )
  }

  return (
    <div
      className="relative group/block"
      onClick={onClickWithin}
      data-block-id={attrs.id}
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
            <div className="flex items-center justify-between px-3 pr-0 gap-x-4 font-sans h-12 divide-x divide-gray-200">
              <div className="select-none text-gray-300 text-xs flex items-center w-full h-full gap-x-1.5">
                <TableCellsIcon className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className={clsx(
                    'text-sm font-sans font-medium pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-800 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset py-0 disabled:ring-0 h-2/3 bg-transparent focus:bg-white'
                  )}
                  placeholder="Pivot Table (click to add a title)"
                  value={attrs.title}
                  onChange={onChangeTitle}
                  disabled={!props.isEditable}
                />
              </div>
              <div className="print:hidden flex items-center gap-x-0 group-focus/block:opacity-100 h-full divide-x divide-gray-200">
                <HeaderSelect
                  value={dataframe?.name ?? ''}
                  onChange={onChangeDataframe}
                  options={dataframeOptions}
                  onAdd={onNewSQL}
                  onAddLabel="New query"
                  disabled={!isEditable}
                  placeholders={['No dataframe selected', 'No dataframes']}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="h-[580px] flex items-center">
          <PivotTableControls
            dataframe={dataframe}
            rows={attrs.rows}
            onChangeRows={onChangeRows}
            columns={attrs.columns}
            onChangeColumns={onChangeColumns}
            metrics={attrs.metrics}
            onChangeMetrics={onChangeMetrics}
            isHidden={attrs.controlsHidden}
            isEditable={isEditable}
          />
          <PivotTableView
            pivotRows={attrs.rows}
            pivotColumns={attrs.columns}
            pivotMetrics={attrs.metrics}
            result={attrs.result}
            page={attrs.page}
            onPrevPage={onPrevPage}
            onNextPage={onNextPage}
            setPage={setPage}
            error={attrs.error}
            loadingTable={loadingTable}
            loadingPage={loadingPage}
            dataframe={dataframe}
            onNewSQL={onNewSQL}
            controlsHidden={attrs.controlsHidden}
            onToggleControlsHidden={onToggleControlsHidden}
            dashboardMode={props.dashboardMode}
            isEditable={isEditable}
            sort={attrs.sort}
            onSort={onSort}
          />
        </div>
      </div>
      <div
        className={clsx(
          'absolute transition-opacity opacity-0 group-hover/block:opacity-100 right-0 translate-x-full pl-1.5 top-0 flex flex-col gap-y-1',
          execStatusIsDisabled(execStatus) ? 'opacity-100' : 'opacity-0',
          {
            hidden: !props.isEditable,
          }
        )}
      >
        <TooltipV2<HTMLButtonElement> {...runTooltipContent} active={true}>
          {(ref) => (
            <button
              ref={ref}
              className={clsx(
                {
                  'bg-gray-200 cursor-not-allowed':
                    execStatus !== 'idle' &&
                    execStatus !== 'running' &&
                    execStatus !== 'completed' &&
                    execStatus !== 'unknown',
                  'bg-red-200':
                    execStatus === 'running' && envStatus === 'Running',
                  'bg-yellow-300':
                    execStatus === 'running' && envStatus !== 'Running',
                  'bg-primary-200':
                    execStatus === 'idle' ||
                    execStatus === 'completed' ||
                    execStatus === 'unknown',
                },
                'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
              )}
              onClick={onRunAbort}
              disabled={
                !dataframe ||
                !isEditable ||
                (execStatus !== 'idle' &&
                  execStatus !== 'running' &&
                  execStatus !== 'completed' &&
                  execStatus !== 'unknown')
              }
            >
              {isExecutionStatusLoading(execStatus) ? (
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

export default PivotTableBlock
