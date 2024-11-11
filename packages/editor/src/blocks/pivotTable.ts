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
import { clone } from 'ramda'
import {
  AggregateFunction,
  DataFrameColumn,
  PivotTableResult,
  PivotTableSort,
} from '@briefer/types'
import { ExecutionStatus } from '../execution/item.js'

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
  status:
    | 'idle'
    | 'run-requested'
    | 'running'
    | 'run-all-enqueued'
    | 'run-all-running'
    | 'page-requested'
    | 'loading-page'
    | 'abort-requested'
    | 'aborting'
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
  blocks: Y.Map<YBlock>
): Y.XmlElement<PivotTableBlock> => {
  const yBlock = new Y.XmlElement<PivotTableBlock>('block')

  const attrs: PivotTableBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.PivotTable,
    status: 'idle',
    variable: getAvailablePivotVariable(blocks),
    dataframeName: null,
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
    status: getAttributeOr(block, 'status', 'idle'),
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
    status: prevAttributes.status,
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
  block: Y.XmlElement<PivotTableBlock>
): ExecutionStatus {
  const status = block.getAttribute('status')

  switch (status) {
    case undefined:
    case 'idle':
      return 'completed'
    case 'run-all-enqueued':
    case 'run-requested':
      return 'enqueued'
    case 'running':
    case 'run-all-running':
    case 'page-requested':
    case 'loading-page':
      return 'running'
    case 'abort-requested':
    case 'aborting':
      return 'aborting'
  }
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
    // TODO renaming of pivot table
    // status: 'idle',
    error: null,
  }
}
