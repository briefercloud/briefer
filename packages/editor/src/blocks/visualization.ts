import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  ExecStatus,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
} from './index.js'
import {
  AggregateFunction,
  ChartType,
  DataFrameColumn,
  HistogramBin,
  HistogramFormat,
  JsonObject,
  TimeUnit,
  VisualizationFilter,
  YAxis,
} from '@briefer/types'
import { clone } from 'ramda'

export type VisualizationBlock = BaseBlock<BlockType.Visualization> & {
  dataframeName: string | null
  spec: JsonObject | null
  chartType: ChartType
  xAxis: DataFrameColumn | null
  xAxisName: string | null
  xAxisSort: 'ascending' | 'descending'
  xAxisGroupFunction: TimeUnit | null
  yAxes: YAxis[]

  // @deprecated use yAxes instead
  yAxis: DataFrameColumn | null
  // @deprecated use yAxes instead
  yAxisName: string | null
  // @deprecated use yAxes instead
  yAxisAggregateFunction: AggregateFunction | null
  // @deprecated use yAxes instead
  colorBy: DataFrameColumn | null

  histogramFormat: HistogramFormat
  histogramBin: HistogramBin
  numberValuesFormat: string | null
  showDataLabels: boolean
  controlsHidden: boolean
  filters: VisualizationFilter[]
  tooManyDataPointsHidden: boolean
  error: 'dataframe-not-found' | 'unknown' | 'invalid-params' | null
  updatedAt: string | null
}

export const isVisualizationBlock = (
  block: YBlock
): block is Y.XmlElement<VisualizationBlock> =>
  block.getAttribute('type') === BlockType.Visualization

export const makeVisualizationBlock = (
  id: string,
  init?: Partial<VisualizationBlock>
): Y.XmlElement<VisualizationBlock> => {
  const yBlock = new Y.XmlElement<VisualizationBlock>('block')

  const attrs: VisualizationBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.Visualization,
    dataframeName: null,
    spec: null,
    chartType: 'groupedColumn',
    xAxis: null,
    xAxisName: null,
    xAxisSort: 'ascending',
    xAxisGroupFunction: null,
    yAxis: null,
    yAxisName: null,
    yAxisAggregateFunction: null,
    yAxes: [
      {
        series: [
          {
            axisName: null,
            column: null,
            aggregateFunction: null,
            colorBy: null,
            chartType: null,
          },
        ],
      },
    ],
    colorBy: null,
    histogramFormat: 'count',
    histogramBin: { type: 'auto' },
    numberValuesFormat: null,
    showDataLabels: false,
    controlsHidden: false,
    tooManyDataPointsHidden: false,
    filters: [],
    error: null,
    updatedAt: null,
    ...(init ?? {}),
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getYAxes(block: Y.XmlElement<VisualizationBlock>): YAxis[] {
  let yAxes = getAttributeOr(block, 'yAxes', [])
  const yAxis = getAttributeOr(block, 'yAxis', null)
  const yAxisName = getAttributeOr(block, 'yAxisName', null)
  const yAxisAggregateFunction = getAttributeOr(
    block,
    'yAxisAggregateFunction',
    null
  )
  const colorBy = getAttributeOr(block, 'colorBy', null)
  if (yAxis || yAxisName || yAxisAggregateFunction || colorBy) {
    yAxes = [
      {
        series: [
          {
            axisName: null,
            column: yAxis,
            aggregateFunction: yAxisAggregateFunction,
            colorBy,
            chartType: null,
          },
        ],
      },
      ...yAxes,
    ]

    block.doc?.transact(() => {
      block.setAttribute('yAxis', null)
      block.setAttribute('yAxisName', null)
      block.setAttribute('yAxisAggregateFunction', null)
      block.setAttribute('colorBy', null)
      block.setAttribute('yAxes', yAxes)
    })
  }

  if (yAxes.length === 0) {
    yAxes = [
      {
        series: [
          {
            axisName: null,
            column: null,
            aggregateFunction: null,
            colorBy: null,
            chartType: null,
          },
        ],
      },
    ]
  }

  return yAxes
}

export function getVisualizationAttributes(
  block: Y.XmlElement<VisualizationBlock>
): VisualizationBlock {
  const yAxes = getYAxes(block)

  return {
    ...getBaseAttributes(block),
    dataframeName: getAttributeOr(block, 'dataframeName', null),
    spec: getAttributeOr(block, 'spec', null),
    chartType: getAttributeOr(block, 'chartType', 'groupedColumn'),
    xAxis: getAttributeOr(block, 'xAxis', null),
    xAxisName: getAttributeOr(block, 'xAxisName', null),
    xAxisSort: getAttributeOr(block, 'xAxisSort', 'ascending'),
    xAxisGroupFunction: getAttributeOr(block, 'xAxisGroupFunction', null),
    yAxis: getAttributeOr(block, 'yAxis', null),
    yAxisName: getAttributeOr(block, 'yAxisName', null),
    yAxisAggregateFunction: getAttributeOr(
      block,
      'yAxisAggregateFunction',
      null
    ),
    yAxes,
    colorBy: getAttributeOr(block, 'colorBy', null),
    histogramFormat: getAttributeOr(block, 'histogramFormat', 'count'),
    histogramBin: getAttributeOr(block, 'histogramBin', { type: 'auto' }),
    numberValuesFormat: getAttributeOr(block, 'numberValuesFormat', null),
    showDataLabels: getAttributeOr(block, 'showDataLabels', false),
    controlsHidden: getAttributeOr(block, 'controlsHidden', false),
    filters: getAttributeOr(block, 'filters', []),
    error: getAttributeOr(block, 'error', null),
    tooManyDataPointsHidden: getAttributeOr(
      block,
      'tooManyDataPointsHidden',
      false
    ),
    updatedAt: getAttributeOr(block, 'updatedAt', null),
  }
}

export function duplicateVisualizationBlock(
  newId: string,
  block: Y.XmlElement<VisualizationBlock>
): Y.XmlElement<VisualizationBlock> {
  const prevAttributes = getVisualizationAttributes(block)

  const nextBlock = makeVisualizationBlock(newId)

  const nextAttributes: VisualizationBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    dataframeName: prevAttributes.dataframeName,
    spec: clone(prevAttributes.spec),
    chartType: prevAttributes.chartType,
    xAxis: prevAttributes.xAxis,
    xAxisName: prevAttributes.xAxisName,
    xAxisSort: prevAttributes.xAxisSort,
    xAxisGroupFunction: prevAttributes.xAxisGroupFunction,
    yAxis: prevAttributes.yAxis,
    yAxisName: prevAttributes.yAxisName,
    yAxisAggregateFunction: prevAttributes.yAxisAggregateFunction,
    yAxes: clone(prevAttributes.yAxes),
    colorBy: prevAttributes.colorBy,
    histogramFormat: prevAttributes.histogramFormat,
    histogramBin: clone(prevAttributes.histogramBin),
    numberValuesFormat: prevAttributes.numberValuesFormat,
    showDataLabels: prevAttributes.showDataLabels,
    controlsHidden: prevAttributes.controlsHidden,
    filters: clone(prevAttributes.filters),
    error: prevAttributes.error,
    tooManyDataPointsHidden: prevAttributes.tooManyDataPointsHidden,
    updatedAt: prevAttributes.updatedAt,
  }

  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    nextBlock.setAttribute(key, value)
  }

  return nextBlock
}

export function getVisualizationBlockResultStatus(
  block: Y.XmlElement<VisualizationBlock>
): ExecStatus {
  const error = block.getAttribute('error')
  const updatedAt = block.getAttribute('updatedAt')

  switch (error) {
    case 'dataframe-not-found':
    case 'unknown':
    case 'invalid-params':
      return 'error'
    case null:
    case undefined:
      return updatedAt ? 'success' : 'idle'
  }
}

export function getVisualizationBlockExecutedAt(
  block: Y.XmlElement<VisualizationBlock>
): Date | null {
  const updatedAt = getVisualizationAttributes(block).updatedAt?.trim()
  if (!updatedAt) {
    return null
  }

  return new Date(updatedAt)
}

export function getVisualizationBlockIsDirty(
  _block: Y.XmlElement<VisualizationBlock>
): boolean {
  // assume it is never dirty since it runs automatically on change
  return false
}

export function getVisualizationBlockErrorMessage(
  block: Y.XmlElement<VisualizationBlock>
): string | null {
  const error = block.getAttribute('error')
  const dataframe = block.getAttribute('dataframeName')

  switch (error) {
    case 'dataframe-not-found':
      return `Dataframe ${dataframe} not found`
    case 'invalid-params':
      return 'Missing or invalid parameters'
    case 'unknown':
    case null:
    case undefined:
      return null
  }
}
