import { ConnectDragPreview } from 'react-dnd'
import * as Y from 'yjs'
import { DataFrame, PivotTableSort } from '@briefer/types'
import {
  BlockType,
  PivotTableColumn,
  PivotTableMetric,
  PivotTableRow,
  YBlock,
  execStatusIsDisabled,
  getDataframe,
  getPivotTableAttributes,
  getPivotTableBlockExecStatus,
  type PivotTableBlock,
} from '@briefer/editor'
import clsx from 'clsx'
import { useCallback, useEffect, useMemo, useState } from 'react'
import HeaderSelect from '@/components/HeaderSelect'
import PivotTableControls from './PivotTableControls'
import PivotTableView from './PivotTableView'
import { equals } from 'ramda'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import { ArrowPathIcon, ClockIcon, StopIcon } from '@heroicons/react/20/solid'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { PivotTableExecTooltip } from '../../ExecTooltip'
import LargeSpinner from '@/components/LargeSpinner'
import useEditorAwareness from '@/hooks/useEditorAwareness'

interface Props {
  workspaceId: string
  dataframes: Y.Map<DataFrame>
  block: Y.XmlElement<PivotTableBlock>
  blocks: Y.Map<YBlock>
  dragPreview: ConnectDragPreview | null
  isEditable: boolean
  onRun: (
    block: Y.XmlElement<PivotTableBlock>,
    customCallback?: (block: Y.XmlElement<PivotTableBlock>) => void
  ) => void
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
  useEffect(() => {
    if (isDirty) {
      props.onRun(props.block)
      setIsDirty(false)
    }
  }, [isDirty, props.block, props.onRun])

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
      props.onRun(props.block, (b) =>
        b.setAttribute('status', 'page-requested')
      )
    }
    if (props.block.doc) {
      props.block.doc.transact(run)
    } else {
      run()
    }
  }, [props.block, attrs.page, props.onRun])

  const onNextPage = useCallback(() => {
    const run = () => {
      props.block.setAttribute('page', attrs.page + 1)
      props.onRun(props.block, (b) =>
        b.setAttribute('status', 'page-requested')
      )
    }
    if (props.block.doc) {
      props.block.doc.transact(run)
    } else {
      run()
    }
  }, [props.block, attrs.page, props.onRun])

  const setPage = useCallback(
    (page: number) => {
      const run = () => {
        props.block.setAttribute('page', page + 1)
        props.onRun(props.block, (b) =>
          b.setAttribute('status', 'page-requested')
        )
      }

      if (props.block.doc) {
        props.block.doc.transact(run)
      } else {
        run()
      }
    },
    [props.block, props.onRun]
  )

  const loadingTable: boolean = useMemo(() => {
    switch (attrs.status) {
      case 'page-requested':
      case 'loading-page':
      case 'idle':
        return false
      case 'run-requested':
      case 'running':
      case 'abort-requested':
      case 'aborting':
      case 'run-all-enqueued':
      case 'run-all-running':
        return true
    }
  }, [attrs.status])

  const loadingPage: boolean = useMemo(() => {
    switch (attrs.status) {
      case 'page-requested':
      case 'loading-page':
        return true
      case 'idle':
      case 'run-requested':
      case 'running':
      case 'abort-requested':
      case 'aborting':
      case 'run-all-enqueued':
      case 'run-all-running':
        return false
    }
  }, [attrs.status])

  const isEditable =
    props.isEditable &&
    attrs.status !== 'run-all-enqueued' &&
    attrs.status !== 'run-all-running'

  const execStatus = getPivotTableBlockExecStatus(props.block)

  const onRunAbort = useCallback(() => {
    if (attrs.status === 'running') {
      props.block.setAttribute('status', 'abort-requested')
    } else {
      props.onRun(props.block)
    }
  }, [props.block, props.onRun, attrs.status])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(attrs.id)
  }, [props.onToggleIsBlockHiddenInPublished, attrs.id])

  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.workspaceId
  )

  const onSort = useCallback(
    (sort: PivotTableSort | null) => {
      props.block.setAttribute('sort', sort)
      props.onRun(props.block, (b) =>
        b.setAttribute('status', 'page-requested')
      )
    },
    [props.block, props.onRun]
  )

  const [, editorAPI] = useEditorAwareness()
  const onClickWithin = useCallback(() => {
    editorAPI.insert(attrs.id, { scrollIntoView: false })
  }, [attrs.id, editorAPI.insert])

  if (props.dashboardMode !== 'none') {
    if (!attrs.result) {
      return (
        <div className="flex items-center justify-center h-full">
          {attrs.status !== 'idle' ? (
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
      onClick={onClickWithin}
      className={clsx(
        'relative group/block bg-white printable-block h-full rounded-md border',
        props.isBlockHiddenInPublished && 'border-dashed',
        props.hasMultipleTabs ? 'rounded-tl-none' : 'rounded-tl-md',
        props.isCursorWithin ? 'border-blue-400 shadow-sm' : 'border-gray-200'
      )}
      data-block-id={attrs.id}
    >
      <div className="h-full">
        <div className="py-3">
          <div
            className="flex items-center justify-between px-3 pr-3 gap-x-2 h-[1.6rem] font-sans"
            ref={(d) => {
              props.dragPreview?.(d)
            }}
          >
            <div className="flex gap-x-4 h-full w-full">
              <input
                type="text"
                disabled={!isEditable}
                className={clsx(
                  'font-sans bg-transparent pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-500 disabled:ring-0 hover:ring-1 focus:ring-1 ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs h-full'
                )}
                placeholder="Pivot Table"
                value={attrs.title}
                onChange={onChangeTitle}
              />
              <div className="print:hidden flex gap-x-2 min-h-3 text-xs">
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
        <div className="h-[496px] border-t border-gray-200 flex items-center">
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
        <button
          className={clsx(
            {
              'bg-gray-200 cursor-not-allowed':
                attrs.status !== 'idle' && attrs.status !== 'running',
              'bg-red-200':
                attrs.status === 'running' && envStatus === 'Running',
              'bg-yellow-300':
                attrs.status === 'running' && envStatus !== 'Running',
              'bg-primary-200': attrs.status === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
          onClick={onRunAbort}
          disabled={
            !dataframe ||
            !isEditable ||
            (attrs.status !== 'idle' && attrs.status !== 'running')
          }
        >
          {attrs.status !== 'idle' ? (
            <div>
              {execStatus === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <PivotTableExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={
                  attrs.status === 'run-requested' ||
                  attrs.status === 'run-all-enqueued'
                    ? 'enqueued'
                    : 'running'
                }
                runningAll={
                  attrs.status === 'run-all-enqueued' ||
                  attrs.status === 'run-all-running'
                }
              />
            </div>
          ) : (
            <RunPivotTableTooltip />
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

function RunPivotTableTooltip() {
  return (
    <div>
      <ArrowPathIcon className="w-3 h-3 text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
        <span>Refresh</span>
      </div>
    </div>
  )
}

export default PivotTableBlock
