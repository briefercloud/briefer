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
  isExecutionStatusLoading,
  YBlock,
} from '@briefer/editor'
import { ApiDocument } from '@briefer/database'
import { ChartPieIcon } from '@heroicons/react/24/solid'
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
  JsonObject,
} from '@briefer/types'
import VisualizationControls from './VisualizationControls'
import VisualizationView from './VisualizationView'
import { ConnectDragPreview } from 'react-dnd'
import { clone, equals, head } from 'ramda'
import { useEnvironmentStatus } from '@/hooks/useEnvironmentStatus'
import { VisualizationExecTooltip } from '../../ExecTooltip'
import useFullScreenDocument from '@/hooks/useFullScreenDocument'
import HiddenInPublishedButton from '../../HiddenInPublishedButton'
import useEditorAwareness from '@/hooks/useEditorAwareness'
import { downloadFile } from '@/utils/file'
import { useBlockExecutions } from '@/hooks/useBlockExecution'
import { FunnelIcon } from '@heroicons/react/24/outline'

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

function convertToTimeZone(date: Date, timeZone: string) {
  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })

  const parts = dateFormatter.formatToParts(date)
  const dateParts: Record<string, string> = {}

  parts.forEach(({ type, value }) => {
    if (type !== 'literal') {
      dateParts[type] = value
    }
  })

  const isoString = `${dateParts.year}-${dateParts.month}-${dateParts.day}T${dateParts.hour}:${dateParts.minute}:${dateParts.second}`
  return new Date(isoString)
}

function fixSpecTimezones(
  inputSpec: JsonObject,
  xAxis: DataFrameColumn,
  xAxisTimezone: string | null,
  xAxisName: string | null
) {
  const spec = clone(inputSpec)
  try {
    const timeZone = xAxisTimezone ?? 'UTC'
    const datasets = spec.datasets
    if (
      datasets == null ||
      Array.isArray(datasets) ||
      typeof datasets !== 'object'
    ) {
      console.error('Failed to fix timezones: datasets is not an object')
      return datasets
    }

    for (const [datasetName, dataset] of Object.entries(datasets)) {
      if (!Array.isArray(dataset)) {
        console.error(
          `Failed to fix timezones for dataset ${datasetName}. Dataset is not an array`
        )
        continue
      }

      for (const [i, row] of Array.from(dataset.entries())) {
        if (row === null || Array.isArray(row) || typeof row !== 'object') {
          console.error(
            `Failed to fix timezones for dataset ${datasetName}, row ${i}. Row is not an object`
          )
          continue
        }

        for (const [columnName, value] of Object.entries(row)) {
          if (
            typeof value === 'string' &&
            (xAxisName === columnName ||
              columnName.startsWith(xAxis.name.toString()))
          ) {
            const date = new Date(value)
            const dateInTimezone = convertToTimeZone(date, timeZone)

            const newValue = dateInTimezone.toISOString()

            row[columnName] = newValue
          }
        }
      }
    }
    return datasets
  } catch (e) {
    console.error('Failed to fix timezones', e)
    return spec['datasets']
  }
}

interface Props {
  document: ApiDocument
  dataframes: Y.Map<DataFrame>
  block: Y.XmlElement<VisualizationBlock>
  blocks: Y.Map<YBlock>
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
    xAxisTimezone,
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

  const executions = useBlockExecutions(
    props.executionQueue,
    props.block,
    'visualization'
  )
  const execution = head(executions) ?? null
  const status = execution?.item.getStatus()._tag ?? 'idle'

  const {
    status: envStatus,
    loading: envLoading,
    startedAt: environmentStartedAt,
  } = useEnvironmentStatus(props.document.workspaceId)

  const onRun = useCallback(() => {
    executions.forEach((e) => e.item.setAborting())
    props.executionQueue.enqueueBlock(
      blockId,
      props.userId,
      environmentStartedAt,
      {
        _tag: 'visualization',
      }
    )
  }, [
    executions,
    blockId,
    props.executionQueue,
    environmentStartedAt,
    props.userId,
  ])

  const onRunAbort = useCallback(() => {
    switch (status) {
      case 'enqueued':
      case 'running':
        execution?.item.setAborting()
        break
      case 'idle':
      case 'unknown':
      case 'completed':
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

    if (xAxis && NumpyDateTypes.safeParse(xAxis.type).success) {
      blockSpec['datasets'] = fixSpecTimezones(
        blockSpec,
        xAxis,
        xAxisTimezone,
        xAxisName
      )
    }

    return {
      ...blockSpec,
      width: 'container',
      autosize: { type: 'fit', contains: 'padding' },
      padding: { left: 16, right: 16, top: 12, bottom: 12 },
      config: blockSpecConfig,
    } as VisualizationSpec
  }, [blockSpec, xAxis, xAxisTimezone, xAxisName])

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
            key === 'xAxisTimezone' ||
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

  const viewLoading = isExecutionStatusLoading(status)

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
            <div className="flex items-center justify-between px-3 pr-0 gap-x-4 font-sans h-12 divide-x divide-gray-200">
              <div className="select-none text-gray-300 text-xs flex items-center w-full h-full gap-x-1.5">
                <ChartPieIcon className="h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  className={clsx(
                    'text-sm font-sans font-medium pl-1 ring-gray-200 focus:ring-gray-400 block w-full rounded-md border-0 text-gray-800 hover:ring-1 focus:ring-1 ring-inset focus:ring-inset placeholder:text-gray-400 focus:ring-inset py-0 disabled:ring-0 h-2/3 bg-transparent focus:bg-white'
                  )}
                  placeholder="Visualization (click to add a title)"
                  value={title}
                  onChange={onChangeTitle}
                  disabled={!props.isEditable}
                />
              </div>
              <div className="print:hidden flex items-center gap-x-0 group-focus/block:opacity-100 h-full divide-x divide-gray-200">
                <button
                  className={clsx(
                    'font-sans text-xs flex items-center gap-x-1.5 text-gray-400 px-2.5 whitespace-nowrap disabled:bg-white hover:bg-gray-100 disabled:cursor-not-allowed h-full min-w-[124px]',
                    props.isPublicMode ? 'hidden' : 'inline-block'
                  )}
                  onClick={onAddFilter}
                  disabled={!props.isEditable}
                >
                  <FunnelIcon className="h-4 w-4 text-gray-400" />
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
        <div className="h-[600px] border-t border-gray-200 flex items-center">
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
                status !== 'idle' && status !== 'running',
              'bg-red-200': status === 'running' && envStatus === 'Running',
              'bg-yellow-300': status === 'running' && envStatus !== 'Running',
              'bg-primary-200': status === 'idle',
            },
            'rounded-sm h-6 min-w-6 flex items-center justify-center relative group'
          )}
          onClick={onRunAbort}
          disabled={
            !dataframe ||
            (!xAxis && chartType !== 'number' && chartType !== 'trend') ||
            (!hasAValidYAxis && chartType !== 'histogram') ||
            !props.isEditable ||
            (status !== 'idle' && status !== 'running')
          }
        >
          {status !== 'idle' ? (
            <div>
              {status === 'enqueued' ? (
                <ClockIcon className="w-3 h-3 text-gray-500" />
              ) : (
                <StopIcon className="w-3 h-3 text-gray-500" />
              )}
              <VisualizationExecTooltip
                envStatus={envStatus}
                envLoading={envLoading}
                execStatus={status === 'enqueued' ? 'enqueued' : 'running'}
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
