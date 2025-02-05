import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
  YBlock,
  EditableField,
  ResultStatus,
} from './index.js'
import { clone, head } from 'ramda'
import {
  AggregateFunction,
  DataFrameColumn,
  PivotTableResult,
  PivotTableSort,
} from '@briefer/types'
import { ExecutionStatus } from '../execution/item.js'
import { ExecutionQueue } from '../execution/queue.js'

export type PivotTableRow = {
  column: DataFrameColumn | null
}
export type PivotTableColumn = {
  column: DataFrameColumn | null
}
export type PivotTableMetric = {
  column: DataFrameColumn | null
  aggregateFunction: AggregateFunction
}

export type PivotTableBlock = BaseBlock<BlockType.PivotTable> & {
  dataframeName: string | null
  variable: EditableField<'invalid-variable-name' | 'unexpected-error'>
  rows: PivotTableRow[]
  columns: PivotTableColumn[]
  metrics: PivotTableMetric[]
  sort: PivotTableSort | null
  controlsHidden: boolean
  error: 'dataframe-not-found' | 'unknown' | null
  updatedAt: string | null
  page: number
  result: PivotTableResult | null
}

export const makePivotTableBlock = (
  id: string,
  blocks: Y.Map<YBlock>,
  dataframeName: string | null = null
): Y.XmlElement<PivotTableBlock> => {
  const yBlock = new Y.XmlElement<PivotTableBlock>('block')

  const attrs: PivotTableBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.PivotTable,
    variable: getAvailablePivotVariable(blocks),
    dataframeName,
    rows: [{ column: null }],
    columns: [{ column: null }],
    metrics: [{ column: null, aggregateFunction: 'count' }],
    sort: null,
    controlsHidden: false,
    error: null,
    updatedAt: null,
    page: 1,
    result: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    yBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yBlock
}

export function getPivotTableAttributes(
  block: Y.XmlElement<PivotTableBlock>,
  blocks: Y.Map<YBlock>
): PivotTableBlock {
  const variable = getAttributeOr(
    block,
    'variable',
    getAvailablePivotVariable(blocks)
  )

  return {
    ...getBaseAttributes(block),
    dataframeName: getAttributeOr(block, 'dataframeName', null),
    variable,
    rows: getAttributeOr(block, 'rows', []),
    columns: getAttributeOr(block, 'columns', []),
    metrics: getAttributeOr(block, 'metrics', []),
    sort: getAttributeOr(block, 'sort', null),
    controlsHidden: getAttributeOr(block, 'controlsHidden', false),
    error: getAttributeOr(block, 'error', null),
    updatedAt: getAttributeOr(block, 'updatedAt', null),
    page: getAttributeOr(block, 'page', 1),
    result: getAttributeOr(block, 'result', null),
  }
}

export function duplicatePivotTableBlock(
  newId: string,
  block: Y.XmlElement<PivotTableBlock>,
  blocks: Y.Map<YBlock>,
  newVariable: boolean
): Y.XmlElement<PivotTableBlock> {
  const prevAttributes = getPivotTableAttributes(block, blocks)

  const nextBlock = makePivotTableBlock(newId, blocks)

  const nextAttributes: PivotTableBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    dataframeName: prevAttributes.dataframeName,
    variable: newVariable
      ? getAvailablePivotVariable(blocks)
      : clone(prevAttributes.variable),
    rows: clone(prevAttributes.rows),
    columns: clone(prevAttributes.columns),
    metrics: clone(prevAttributes.metrics),
    sort: clone(prevAttributes.sort),
    controlsHidden: prevAttributes.controlsHidden,
    error: prevAttributes.error,
    updatedAt: prevAttributes.updatedAt,
    page: prevAttributes.page,
    result: clone(prevAttributes.result),
  }

  for (const [key, value] of Object.entries(nextAttributes)) {
    nextBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return nextBlock
}

export function getPivotTableBlockExecStatus(
  block: Y.XmlElement<PivotTableBlock>,
  executionQueue: ExecutionQueue
): ExecutionStatus {
  const blockId = getBaseAttributes(block).id
  const executions = executionQueue
    .getBlockExecutions(blockId, 'pivot-table')
    .concat(executionQueue.getBlockExecutions(blockId, 'pivot-table-load-page'))
  const execution = head(executions)
  if (execution) {
    return execution.item.getStatus()._tag
  }

  return 'completed'
}

export function getPivotTableBlockResultStatus(
  block: Y.XmlElement<PivotTableBlock>
): ResultStatus {
  const error = block.getAttribute('error')
  const updatedAt = block.getAttribute('updatedAt')

  switch (error) {
    case 'dataframe-not-found':
    case 'unknown':
      return 'error'
    case null:
    case undefined:
      return updatedAt ? 'success' : 'idle'
  }
}

export function getPivotTableBlockExecutedAt(
  block: Y.XmlElement<PivotTableBlock>,
  blocks: Y.Map<YBlock>
): Date | null {
  const updatedAt = getPivotTableAttributes(block, blocks).updatedAt?.trim()
  if (!updatedAt) {
    return null
  }

  return new Date(updatedAt)
}

export function getPivotTableBlockIsDirty(
  _block: Y.XmlElement<PivotTableBlock>
): boolean {
  // assume it is never dirty since it runs automatically on change
  return false
}

export function getPivotTableBlockErrorMessage(
  block: Y.XmlElement<PivotTableBlock>
): string | null {
  const error = block.getAttribute('error')
  const dataframe = block.getAttribute('dataframeName')

  switch (error) {
    case 'dataframe-not-found':
      return `Dataframe ${dataframe} not found`
    case 'unknown':
    case null:
    case undefined:
      return null
  }
}

export const isPivotTableBlock = (
  block: YBlock
): block is Y.XmlElement<PivotTableBlock> =>
  block.getAttribute('type') === BlockType.PivotTable

function getAvailablePivotVariable(
  blocks: Y.Map<YBlock>
): PivotTableBlock['variable'] {
  const pivotBlocks = Array.from(blocks.values()).filter(isPivotTableBlock)
  const vars = new Set(
    pivotBlocks.map((block) => block.getAttribute('variable')?.value)
  )

  let i = 1
  while (vars.has(`pivot_table_${i}`)) {
    i++
  }

  return {
    value: `pivot_table_${i}`,
    newValue: `pivot_table_${i}`,
    error: null,
  }
}
