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
import { ChartType, DataFrameColumn, TimeUnit, YAxis } from '@briefer/types'
import { clone } from 'ramda'

export type VisualizationV2BlockInput = {
  dataframeName: string | null
  chartType: ChartType
  xAxis: DataFrameColumn | null
  xAxisName: string | null
  xAxisSort: 'ascending' | 'descending'
  xAxisGroupFunction: TimeUnit | null
  yAxes: YAxis[]
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
})

const OrdinalRawValue = z.string().or(z.number())

const CategoryAxisBaseOption = z.object({
  type: z.literal('category'),
})

const TimeAxisBaseOption = z.object({
  type: z.literal('time'),
})

const AxisBaseOption = z.union([
  ValueAxisBaseOption,
  CategoryAxisBaseOption,
  TimeAxisBaseOption,
])

const CartesianAxisOption = z
  .object({
    position: CartesianAxisPosition.optional(),
  })
  .and(AxisBaseOption)

const DataSet = z.object({
  dimensions: z.array(z.string()),
  source: z.array(z.record(OrdinalRawValue)),
})

const Serie = z.union([
  z.object({
    type: z.union([z.literal('bar'), z.literal('scatter')]),
  }),
  z.object({
    type: z.literal('line'),
    areaStyle: z.object({}).optional(),
  }),
])
export const VisualizationV2BlockOutputResult = z.object({
  dataset: DataSet,
  xAxis: z.array(CartesianAxisOption),
  yAxis: z.array(CartesianAxisOption),
  series: z.array(Serie),
})

export type VisualizationV2BlockOutputResult = z.infer<
  typeof VisualizationV2BlockOutputResult
>

export const VisualizationV2BlockOutput = z.object({
  executedAt: z.string(),
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

function getYAxes(input: VisualizationV2BlockInput): YAxis[] {
  if (input.yAxes.length === 0) {
    return [
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
  const error = block.getAttribute('error')
  const output = block.getAttribute('output')

  switch (error) {
    case 'dataframe-not-found':
    case 'dataframe-not-set':
    case 'unknown':
    case 'invalid-params':
      return 'error'
    case null:
    case undefined:
      return output === null ? 'idle' : 'success'
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
