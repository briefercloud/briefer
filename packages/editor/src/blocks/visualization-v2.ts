import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
  ResultStatus,
  YBlock,
} from './index.js'
import {
  ChartType,
  DataFrame,
  DataFrameColumn,
  HistogramBin,
  HistogramFormat,
  TimeUnit,
  VisualizationFilter,
  YAxisV2,
} from '@briefer/types'
import { clone } from 'ramda'

export type VisualizationV2BlockInput = {
  dataframeName: string | null
  chartType: ChartType
  xAxis: DataFrameColumn | null
  xAxisName: string | null
  xAxisSort: 'ascending' | 'descending'
  xAxisGroupFunction: TimeUnit | null
  yAxes: YAxisV2[]
  histogramFormat: HistogramFormat
  histogramBin: HistogramBin
  filters: VisualizationFilter[]
  dataLabels: {
    show: boolean
    frequency: 'all' | 'some'
  }
}

function emptyInput(): VisualizationV2BlockInput {
  return {
    dataframeName: null,
    chartType: 'groupedColumn',
    xAxis: null,
    xAxisName: null,
    xAxisSort: 'ascending',
    xAxisGroupFunction: null,
    yAxes: [],
    filters: [],
    histogramFormat: 'count',
    histogramBin: { type: 'auto' },
    dataLabels: {
      show: false,
      frequency: 'some',
    },
  }
}

const CartesianAxisPosition = z.union([
  z.literal('top'),
  z.literal('bottom'),
  z.literal('left'),
  z.literal('right'),
])

const ValueAxisBaseOption = z.object({
  type: z.literal('value'),
  min: z.union([z.number(), z.literal('dataMin')]).optional(),
  max: z.union([z.number(), z.literal('dataMax')]).optional(),
})

const OrdinalRawValue = z.string().or(z.number())

const CategoryAxisBaseOption = z.object({
  type: z.literal('category'),
})

const TimeAxisBaseOption = z.object({
  type: z.literal('time'),
  min: z.string().optional(),
  max: z.string().optional(),
})

const AxisBaseOption = z.union([
  ValueAxisBaseOption,
  CategoryAxisBaseOption,
  TimeAxisBaseOption,
])

const CartesianAxisOption = z
  .object({
    position: CartesianAxisPosition.optional(),
    name: z.string().optional().nullable(),
    nameLocation: z.literal('middle'),
    nameGap: z.number().optional(),
  })
  .and(AxisBaseOption)

const DataSet = z.object({
  dimensions: z.array(z.string()),
  source: z.array(z.record(OrdinalRawValue)),
})

const SerieCommon = z.object({
  id: z.string(),
  datasetIndex: z.number(),
  yAxisIndex: z.number(),
  name: z.string().optional(),
  z: z.number(),
  label: z
    .object({
      show: z.boolean(),
      position: z.union([z.literal('inside'), z.literal('top')]),
    })
    .optional(),
  labelLayout: z.object({ hideOverlap: z.boolean() }).optional(),
  encode: z
    .object({
      x: z.string().or(z.number()),
      y: z.string().or(z.number()),
    })
    .optional(),
})

const Serie = z.union([
  SerieCommon.extend({
    type: z.literal('bar'),
    stack: z.string().optional(),
    barWidth: z.string().optional(),
    color: z.string().optional(),
  }),
  SerieCommon.extend({
    type: z.literal('scatter'),
    itemStyle: z
      .object({
        color: z.string().optional(),
      })
      .optional(),
  }),
  SerieCommon.extend({
    type: z.literal('line'),
    areaStyle: z
      .object({
        color: z.string().optional(),
      })
      .optional(),
    lineStyle: z
      .object({
        color: z.string().optional(),
      })
      .optional(),
    itemStyle: z
      .object({
        color: z.string().optional(),
      })
      .optional(),
    stack: z.string().optional(),
    symbolSize: z.number().optional(),
  }),
])

export type Serie = z.infer<typeof Serie>

const XAxis = CartesianAxisOption.and(
  z.object({
    axisPointer: z.object({
      type: z.literal('shadow'),
    }),
  })
)
export type XAxis = z.infer<typeof XAxis>

const YAxis = CartesianAxisOption.and(
  z.object({
    position: z.union([z.literal('left'), z.literal('right')]).optional(),
  })
)

export const VisualizationV2BlockOutputResult = z.object({
  tooltip: z.object({ trigger: z.literal('axis') }),
  legend: z.object({}),
  grid: z.object({ containLabel: z.literal(true) }),
  dataset: z.array(DataSet),
  xAxis: z.array(XAxis),
  yAxis: z.array(YAxis),
  series: z.array(Serie),
})

export type VisualizationV2BlockOutputResult = z.infer<
  typeof VisualizationV2BlockOutputResult
>

export const VisualizationV2BlockOutput = z.object({
  executedAt: z.string(),
  tooManyDataPoints: z.boolean(),
  result: VisualizationV2BlockOutputResult,
})

export type VisualizationV2BlockOutput = z.infer<
  typeof VisualizationV2BlockOutput
>

export type VisualizationV2Block = BaseBlock<BlockType.VisualizationV2> & {
  input: VisualizationV2BlockInput
  output: VisualizationV2BlockOutput | null

  controlsHidden: boolean
  error:
    | 'dataframe-not-found'
    | 'dataframe-not-set'
    | 'unknown'
    | 'invalid-params'
    | null
}

export function isVisualizationV2Block(
  block: YBlock
): block is Y.XmlElement<VisualizationV2Block> {
  return block.getAttribute('type') === BlockType.VisualizationV2
}

export function makeVisualizationV2Block(
  id: string,
  input?: Partial<VisualizationV2BlockInput>
): Y.XmlElement<VisualizationV2Block> {
  const yBlock = new Y.XmlElement<VisualizationV2Block>('block')

  const attrs: VisualizationV2Block = {
    id,
    index: null,
    title: '',
    type: BlockType.VisualizationV2,
    input: { ...emptyInput(), ...(input ?? {}) },
    output: null,
    controlsHidden: false,
    error: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getYAxes(input: VisualizationV2BlockInput): YAxisV2[] {
  if (input.yAxes.length === 0) {
    return [
      {
        id: uuidv4(),
        name: null,
        series: [
          {
            id: uuidv4(),
            column: null,
            aggregateFunction: 'sum',
            groupBy: null,
            chartType: null,
            name: null,
            color: null,
            groups: null,
          },
        ],
      },
    ]
  }

  return input.yAxes
}

export function getVisualizationV2Attributes(
  block: Y.XmlElement<VisualizationV2Block>
): VisualizationV2Block {
  const input = getAttributeOr(block, 'input', emptyInput())
  const yAxes = getYAxes(input)

  return {
    ...getBaseAttributes(block),
    input: { ...input, yAxes },
    output: getAttributeOr(block, 'output', null),
    controlsHidden: getAttributeOr(block, 'controlsHidden', false),
    error: getAttributeOr(block, 'error', null),
  }
}

export function duplicateVisualizationV2Block(
  newId: string,
  block: Y.XmlElement<VisualizationV2Block>
): Y.XmlElement<VisualizationV2Block> {
  const prevAttributes = getVisualizationV2Attributes(block)

  const nextBlock = makeVisualizationV2Block(newId)

  const nextAttributes: VisualizationV2Block = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    input: clone(prevAttributes.input),
    output: clone(prevAttributes.output),
    controlsHidden: prevAttributes.controlsHidden,
    error: prevAttributes.error,
  }

  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    nextBlock.setAttribute(key, value)
  }

  return nextBlock
}

export function getVisualizationV2BlockResultStatus(
  block: Y.XmlElement<VisualizationV2Block>
): ResultStatus {
  const attrs = getVisualizationV2Attributes(block)

  switch (attrs.error) {
    case 'dataframe-not-found':
    case 'dataframe-not-set':
    case 'unknown':
    case 'invalid-params':
      return 'error'
    case null:
    case undefined:
      return attrs.output === null ? 'idle' : 'success'
  }
}

export function getVisualizationV2BlockExecutedAt(
  block: Y.XmlElement<VisualizationV2Block>
): Date | null {
  const executedAt = getVisualizationV2Attributes(block).output?.executedAt
  if (executedAt === undefined) {
    return null
  }

  return new Date(executedAt)
}

export function getVisualizationV2BlockIsDirty(
  _block: Y.XmlElement<VisualizationV2Block>
): boolean {
  // assume it is never dirty since it runs automatically on change
  return false
}

export function getVisualizationV2BlockErrorMessage(
  block: Y.XmlElement<VisualizationV2Block>
): string | null {
  const attrs = getVisualizationV2Attributes(block)

  switch (attrs.error) {
    case 'dataframe-not-found':
      return `Dataframe ${attrs.input.dataframeName} not found`
    case 'dataframe-not-set':
      return 'No Dataframe selected'
    case 'invalid-params':
      return 'Missing or invalid parameters'
    case 'unknown':
    case null:
    case undefined:
      return null
  }
}

export function getDataframeFromVisualizationV2(
  block: Y.XmlElement<VisualizationV2Block>,
  dataframes: Y.Map<DataFrame>
) {
  const attrs = getVisualizationV2Attributes(block)
  const dfName = attrs.input.dataframeName
  if (!dfName) {
    return null
  }

  const df = dataframes.get(dfName)
  if (!df) {
    return null
  }

  return df
}

export function setVisualizationV2Input(
  block: Y.XmlElement<VisualizationV2Block>,
  next: Partial<VisualizationV2BlockInput>
) {
  const current = getVisualizationV2Attributes(block).input
  block.setAttribute('input', {
    ...current,
    ...next,
  })
}
