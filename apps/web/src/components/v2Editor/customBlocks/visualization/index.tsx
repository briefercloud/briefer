import { v4 as uuidv4 } from 'uuid'

import { VisualizationSpec } from 'react-vega'
import { ArrowPathIcon, ClockIcon, StopIcon } from '@heroicons/react/20/solid'
import * as Y from 'yjs'
import {
  type VisualizationBlock,
  BlockType,
  isVisualizationBlock,
  getVisualizationAttributes,
  getDataframe,
  ExecutionQueue,
  Execution,
} from '@briefer/editor'
import { ApiDocument } from '@briefer/database'
import { FunnelIcon } from '@heroicons/react/24/outline'
import { useCallback, useEffect, useMemo, useState } from 'react'
import HeaderSelect from '@/components/HeaderSelect'
import clsx from 'clsx'
import FilterSelector from './FilterSelector'
import {
  ChartType,
  DataFrame,
  DataFrameColumn,
  HistogramBin,
  HistogramFormat,
  TimeUnit,
  VisualizationFilter,
  isInvalidVisualizationFilter,
  NumpyDateTypes,
  YAxis,
  exhaustiveCheck,
} from '@briefer/types'
import VisualizationControls from './VisualizationControls'
import VisualizationView from './VisualizationView'
import { ConnectDragPreview } from 'react-dnd'
import { equals, head } from 'ramda'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { VisualizationExecTooltip } from '../../ExecTooltip'
import useFullScreenDocument from '@/hooks/useFullScreenDocument'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { downloadFile } from '@/utils/file'
import { useBlockExecutions } from '@/hooks/useBlockExecution'

function didChangeFilters(
  oldFilters: VisualizationFilter[],
  newFilters: VisualizationFilter[]
) {
  const toCompare = new Set(newFilters.map((f) => f.id))

  if (oldFilters.length !== newFilters.length) {
    return true
  }

  const didChange = oldFilters.some((of) => {
    const nf = newFilters.find((f) => f.id === of.id)
    if (!nf) {
      return true
    }

    toCompare.delete(of.id)

    return (
      !equals(of.value, nf.value) ||
      of.operator !== nf.operator ||
      of.column?.name !== nf.column?.name
    )
  })

  return didChange || toCompare.size > 0
}

interface Props {
  document: ApiDocument
  dataframes: Y.Map<DataFrame>
  block: Y.XmlElement<VisualizationBlock>
  dragPreview: ConnectDragPreview | null
  isEditable: boolean
  isPublicMode: boolean
  onAddGroupedBlock: (
    blockId: string,
    blockType: BlockType,
    position: 'before' | 'after'
  ) => void
  isDashboard: boolean
  renderer?: 'canvas' | 'svg'
  hasMultipleTabs: boolean
  isBlockHiddenInPublished: boolean
  onToggleIsBlockHiddenInPublished: (blockId: string) => void
  isCursorWithin: boolean
  isCursorInserting: boolean
  executionQueue: ExecutionQueue
  userId: string | null
}
function VisualizationBlock(props: Props) {
  const dataframe = getDataframe(props.block, props.dataframes)

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

  const {
    id: blockId,
    title,
    xAxis,
    xAxisName,
    filters,
    controlsHidden,
    chartType,
    xAxisGroupFunction,
    xAxisSort,
    yAxes,
    histogramFormat,
    histogramBin,
    numberValuesFormat,
    showDataLabels,
    error,
    spec: blockSpec,
  } = getVisualizationAttributes(props.block)

  const onNewSQL = useCallback(() => {
    if (blockId) {
      props.onAddGroupedBlock(blockId, BlockType.SQL, 'before')
    }
  }, [blockId, props.onAddGroupedBlock])

  const onChangeXAxis = useCallback(
    (xAxis: DataFrameColumn | null) => {
      if (xAxis) {
        props.block.setAttribute('xAxis', xAxis)
        const isDateTime = NumpyDateTypes.safeParse(xAxis.type).success
        if (isDateTime && !props.block.getAttribute('xAxisGroupFunction')) {
          props.block.setAttribute('xAxisGroupFunction', 'date')
        }
      } else {
        props.block.removeAttribute('xAxis')
      }
    },
    [props.block]
  )

  const onChangeXAxisName = useCallback(
    (name: string | null) => {
      props.block.setAttribute('xAxisName', name)
    },
    [props.block]
  )

  const executions = useBlockExecutions(props.executionQueue, props.block)
  const execution = head(executions) ?? null
  const status = execution?.item.getStatus() ?? { _tag: 'idle' }

  const onRun = useCallback(() => {
    executions.forEach((e) => e.item.setAborting())
    props.executionQueue.enqueueBlock(blockId, props.userId, {
      _tag: 'visualization',
    })
  }, [executions, blockId, props.executionQueue, props.userId])

  const onRunAbort = useCallback(() => {
    switch (status._tag) {
      case 'enqueued':
      case 'running':
        execution?.item.setAborting()
        break
      case 'idle':
      case 'error':
      case 'success':
      case 'aborted':
        onRun()
        break
      case 'aborting':
        break
      default:
        exhaustiveCheck(status)
    }
  }, [status, execution, onRun])

  const onAddFilter = useCallback(() => {
    const newFilter: VisualizationFilter = {
      id: uuidv4(),
      type: 'unfinished-visualization-filter',
      column: null,
      operator: null,
      value: null,
    }
    props.block.setAttribute('filters', [...filters, newFilter])
  }, [filters, props.block])

  const onChangeFilter = useCallback(
    (filter: VisualizationFilter) => {
      props.block.setAttribute(
        'filters',
        filters.map((f) => (f.id === filter.id ? filter : f))
      )
    },
    [filters, props.block]
  )

  const onRemoveFilter = useCallback(
    (filter: VisualizationFilter) => {
      props.block.setAttribute(
        'filters',
        filters.filter((f) => f.id !== filter.id)
      )
    },
    [filters, props.block]
  )

  const onToggleHidden = useCallback(() => {
    props.block.setAttribute('controlsHidden', !controlsHidden)
  }, [controlsHidden, props.block])

  const onExportToPNG = async () => {
    // we don't need to check if props.renderer is undefined because the application sets as 'canvas' in this case
    if (
      props.renderer === 'svg' ||
      chartType === 'number' ||
      chartType === 'trend'
    )
      return

    // if the controls are visible the canvas shrinks, making the export smaller
    if (!controlsHidden) {
      onToggleHidden()
      // tick to ensure the canvas size gets updated
      await new Promise((r) => setTimeout(r, 0))
    }

    const canvas = document.querySelector(
      `div[data-block-id='${blockId}'] canvas`
    ) as HTMLCanvasElement

    // TODO: identify when this is true
    if (!canvas) return

    const imageUrl = canvas.toDataURL('image/png')
    const fileName = title || 'Visualization'
    downloadFile(imageUrl, fileName)
  }

  const onChangeChartType = useCallback(
    (chartType: ChartType) => {
      props.block.setAttribute('chartType', chartType)
    },
    [props.block]
  )

  const onChangeXAxisGroupFunction = useCallback(
    (groupFunction: TimeUnit | null) => {
      if (groupFunction) {
        props.block.setAttribute('xAxisGroupFunction', groupFunction)
      } else {
        props.block.removeAttribute('xAxisGroupFunction')
      }
    },
    [props.block]
  )

  const onChangeXAxisSort = useCallback(
    (sort: 'ascending' | 'descending') => {
      props.block.setAttribute('xAxisSort', sort)
    },
    [props.block]
  )

  const onChangeHistogramFormat = useCallback(
    (format: HistogramFormat) => {
      props.block.setAttribute('histogramFormat', format)
    },
    [props.block]
  )

  const onChangeHistogramBin = useCallback(
    (bin: HistogramBin) => {
      props.block.setAttribute('histogramBin', bin)
    },
    [props.block]
  )

  const onChangeNumberValuesFormat = useCallback(
    (name: string | null) => {
      props.block.setAttribute('numberValuesFormat', name)
    },
    [props.block]
  )

  const tooManyDataPointsHidden =
    props.block.getAttribute('tooManyDataPointsHidden') ?? true
  const onHideTooManyDataPointsWarning = useCallback(() => {
    props.block.setAttribute('tooManyDataPointsHidden', true)
  }, [props.block])

  const spec = useMemo(() => {
    if (!blockSpec) {
      return null
    }

    const blockSpecConfig =
      typeof blockSpec.config === 'object'
        ? {
            legend: { orient: window.innerWidth < 768 ? 'bottom' : 'right' },

            ...blockSpec.config,
          }
        : blockSpec.config

    return {
      ...blockSpec,
      width: 'container',
      autosize: { type: 'fit', contains: 'padding' },
      padding: { left: 16, right: 16, top: 12, bottom: 12 },
      config: blockSpecConfig,
    } as VisualizationSpec
  }, [blockSpec])

  const onChangeTitle = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      props.block.setAttribute('title', e.target.value)
    },
    [props.block]
  )

  const [isDirty, setIsDirty] = useState(false)
  useEffect(() => {
    if (!dataframe) {
      return
    }

    let timeout: NodeJS.Timeout | null = null
    function observe(event: Y.YXmlEvent) {
      const block = event.target
      if (!(block instanceof Y.XmlElement)) {
        return
      }

      if (!isVisualizationBlock(block)) {
        return
      }

      if (!dataframe) {
        return
      }

      const shouldIgnore =
        event.changes.keys.size === 0 ||
        Array.from(event.changes.keys.entries()).every(
          ([key, val]) =>
            key === 'title' ||
            key === 'status' ||
            key === 'spec' ||
            key === 'controlsHidden' ||
            key === 'tooManyDataPointsHidden' ||
            key === 'error' ||
            key === 'updatedAt' ||
            (key === 'filters' &&
              !didChangeFilters(
                val.oldValue ?? [],
                block.getAttribute('filters') ?? []
              ))
        )

      if (!shouldIgnore) {
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
      onRun()
      setIsDirty(false)
    }
  }, [isDirty, props.block, onRun])

  const { status: envStatus, loading: envLoading } = useEnvironmentStatus(
    props.document.workspaceId
  )

  const [isFullscreen] = useFullScreenDocument(props.document.id)

  const onChangeYAxes = useCallback(
    (yAxes: YAxis[]) => {
      props.block.setAttribute('yAxes', yAxes)
    },
    [props.block]
  )

  const hasAValidYAxis = yAxes.some((yAxis) =>
    yAxis.series.some((s) => s.column !== null)
  )

  const onChangeShowDataLabels = useCallback(
    (showDataLabels: boolean) => {
      props.block.setAttribute('showDataLabels', showDataLabels)
    },
    [props.block]
  )

  // TODO
  // useEffect(() => {
  //   if (status === 'running' || status === 'run-requested') {
  //     // 30 seconds timeout
  //     const timeout = setTimeout(() => {
  //       const status = props.block.getAttribute('status')
  //       if (status === 'running') {
  //         props.block.setAttribute('status', 'run-requested')
  //       } else if (status === 'run-requested') {
  //         props.block.setAttribute('status', 'idle')
  //         requestAnimationFrame(() => {
  //           props.block.setAttribute('status', 'run-requested')
  //         })
  //       }
  //     }, 1000 * 30)

  //     return () => {
  //       clearTimeout(timeout)
  //     }
  //   }
  // }, [props.block, status])

  const onToggleIsBlockHiddenInPublished = useCallback(() => {
    props.onToggleIsBlockHiddenInPublished(blockId)
  }, [props.onToggleIsBlockHiddenInPublished, blockId])

  const [, editorAPI] = useEditorAwareness()
  const onClickWithin = useCallback(() => {
    editorAPI.insert(blockId, { scrollIntoView: false })
  }, [blockId, editorAPI.insert])

  const viewLoading: boolean = (() => {
    switch (status._tag) {
      case 'idle':
      case 'error':
      case 'aborted':
      case 'success':
        return false
      case 'running':
      case 'enqueued':
      case 'aborting':
        return true
    }
  })()

  if (props.isDashboard) {
    return (
      <VisualizationView
        title={title}
        chartType={chartType}
        spec={spec}
        tooManyDataPointsHidden={tooManyDataPointsHidden}
        onHideTooManyDataPointsWarning={onHideTooManyDataPointsWarning}
        loading={viewLoading}
        error={error}
        dataframe={dataframe}
        onNewSQL={onNewSQL}
        controlsHidden={controlsHidden}
        isFullscreen={isFullscreen}
        renderer={props.renderer}
        isHidden={controlsHidden}
        onToggleHidden={onToggleHidden}
        onExportToPNG={onExportToPNG}
        isDashboard={props.isDashboard}
        isEditable={props.isEditable}
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
      data-block-id={blockId}
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
                disabled={!props.isEditable}
                className={clsx(
                  'font-sans bg-transparent pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-500 disabled:ring-0 hover:ring-1 focus:ring-1 ring-inset placeholder:text-gray-400 focus:ring-inset h-full py-0 text-xs h-full'
                )}
                placeholder="Visualization"
                value={title}
                onChange={onChangeTitle}
              />
              <div className="print:hidden flex gap-x-2 min-h-3 text-xs">
                <button
                  className={clsx(
                    'font-sans flex items-center gap-x-1.5 text-gray-400 h-6 px-3 border border-gray-200 rounded-md whitespace-nowrap disabled:bg-white hover:bg-gray-100 disabled:cursor-not-allowed',
                    props.isPublicMode ? 'hidden' : 'inline-block'
                  )}
                  onClick={onAddFilter}
                  disabled={!props.isEditable}
                >
                  <FunnelIcon className="h-3 w-3" />
                  <span>Add filter</span>
                </button>
                <HeaderSelect
                  value={dataframe?.name ?? ''}
                  onChange={onChangeDataframe}
                  options={dataframeOptions}
                  onAdd={onNewSQL}
                  onAddLabel="New query"
                  disabled={!props.isEditable}
                />
              </div>
            </div>
          </div>
        </div>

        <div
          className={clsx(
            'p-2 flex flex-wrap items-center gap-2 min-h[3rem] border-t border-gray-200',
            {
              hidden: filters.length === 0,
            }
          )}
        >
          {filters.map((filter) => (
            <FilterSelector
              key={filter.id}
              filter={filter}
              dataframe={dataframe ?? { name: '', columns: [] }}
              onChange={onChangeFilter}
              onRemove={onRemoveFilter}
              isInvalid={
                !dataframe ||
                (filter.column !== null &&
                  (!dataframe.columns.some(
                    (c) => c.name === filter.column?.name
                  ) ||
                    isInvalidVisualizationFilter(filter, dataframe)))
              }
              disabled={!props.isEditable}
            />
          ))}
        </div>
        <div className="h-[496px] border-t border-gray-200 flex items-center">
          <VisualizationControls
            isHidden={controlsHidden || !props.isEditable}
            dataframe={dataframe}
            chartType={chartType}
            onChangeChartType={onChangeChartType}
            xAxis={xAxis}
            onChangeXAxis={onChangeXAxis}
            xAxisName={xAxisName}
            onChangeXAxisName={onChangeXAxisName}
            xAxisSort={xAxisSort}
            onChangeXAxisSort={onChangeXAxisSort}
            xAxisGroupFunction={xAxisGroupFunction}
            onChangeXAxisGroupFunction={onChangeXAxisGroupFunction}
            yAxes={yAxes}
            onChangeYAxes={onChangeYAxes}
            histogramFormat={histogramFormat}
            onChangeHistogramFormat={onChangeHistogramFormat}
            histogramBin={histogramBin}
            onChangeHistogramBin={onChangeHistogramBin}
            numberValuesFormat={numberValuesFormat}
            onChangeNumberValuesFormat={onChangeNumberValuesFormat}
            showDataLabels={showDataLabels}
            onChangeShowDataLabels={onChangeShowDataLabels}
            isEditable={props.isEditable}
          />
          <VisualizationView
            title={title}
            chartType={chartType}
            spec={spec}
            tooManyDataPointsHidden={tooManyDataPointsHidden}
            onHideTooManyDataPointsWarning={onHideTooManyDataPointsWarning}
            loading={viewLoading}
            error={error}
            dataframe={dataframe}
            onNewSQL={onNewSQL}
            controlsHidden={controlsHidden}
            isFullscreen={isFullscreen}
            renderer={props.renderer}
            isHidden={controlsHidden}
            onToggleHidden={onToggleHidden}
            onExportToPNG={onExportToPNG}
            isDashboard={props.isDashboard}
            isEditable={props.isEditable}
          />
        </div>
      </div>

      <div
        className={clsx(
          'absolute transition-opacity opacity-0 group-hover/block:opacity-100 right-0 translate-x-full pl-1.5 top-0 flex flex-col gap-y-1',
          viewLoading ? 'opacity-100' : 'opacity-0',
          {
            hidden: !props.isEditable,
          }
        )}
      >
        <button
          className={clsx(
            {
              'bg-gray-200 cursor-not-allowed':
                status._tag !== 'idle' && status._tag !== 'running',
              'bg-red-200':
                status._tag === 'running' && envStatus === 'Running',
              'bg-yellow-300':
                status._tag === 'running' && envStatus !== 'Running',
              'bg-primary-200': status._tag === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
          onClick={onRunAbort}
          disabled={
            !dataframe ||
            (!xAxis && chartType !== 'number' && chartType !== 'trend') ||
            (!hasAValidYAxis && chartType !== 'histogram') ||
            !props.isEditable ||
            (status._tag !== 'idle' && status._tag !== 'running')
          }
        >
          {status._tag !== 'idle' ? (
            <div>
              {status._tag === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <VisualizationExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={status._tag === 'enqueued' ? 'enqueued' : 'running'}
                runningAll={execution?.batch.isRunAll() ?? false}
              />
            </div>
          ) : (
            <RunVisualizationTooltip />
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

function RunVisualizationTooltip() {
  return (
    <div>
      <ArrowPathIcon className="w-3 h-3 text-gray-500" />
      <div className="font-sans pointer-events-none absolute -top-1 left-1/2 -translate-y-full -translate-x-1/2 w-max opacity-0 transition-opacity group-hover:opacity-100 bg-hunter-950 text-white text-xs p-2 rounded-md flex flex-col gap-y-1">
        <span>Refresh</span>
      </div>
    </div>
  )
}

export default VisualizationBlock
