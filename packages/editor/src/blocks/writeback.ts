import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
  duplicateYText,
  ResultStatus,
  YBlock,
} from './index.js'
import { WriteBackErrorResult, WriteBackResult } from '@briefer/types'
import { ExecutionStatus } from '../execution/item.js'
import { ExecutionQueue } from '../execution/queue.js'
import { head } from 'ramda'

export type WritebackBlock = BaseBlock<BlockType.Writeback> & {
  dataframeName: string | null
  dataSourceId: string | null
  tableName: Y.Text
  overwriteTable: boolean
  onConflict: 'update' | 'ignore'
  onConflictColumns: string[]
  result: WriteBackResult | null
  isCollapsed: boolean
}

export const makeWritebackBlock = (
  id: string
): Y.XmlElement<WritebackBlock> => {
  const yBlock = new Y.XmlElement<WritebackBlock>('block')
  const attrs: WritebackBlock = {
    id: id,
    index: null,
    type: BlockType.Writeback,
    title: '',
    dataframeName: null,
    dataSourceId: null,
    tableName: new Y.Text(''),
    overwriteTable: false,
    onConflict: 'ignore',
    onConflictColumns: [],
    result: null,
    isCollapsed: false,
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

export function getWritebackAttributes(
  block: Y.XmlElement<WritebackBlock>
): WritebackBlock {
  return {
    ...getBaseAttributes(block),
    dataframeName: getAttributeOr(block, 'dataframeName', null),
    dataSourceId: getAttributeOr(block, 'dataSourceId', null),
    tableName: getAttributeOr(block, 'tableName', new Y.Text('')),
    overwriteTable: getAttributeOr(block, 'overwriteTable', false),
    onConflict: getAttributeOr(block, 'onConflict', 'ignore'),
    onConflictColumns: getAttributeOr(block, 'onConflictColumns', []),
    result: getAttributeOr(block, 'result', null),
    isCollapsed: getAttributeOr(block, 'isCollapsed', false),
  }
}

export function duplicateWritebackBlock(
  newId: string,
  block: Y.XmlElement<WritebackBlock>,
  options?: { datasourceMap?: Map<string, string> }
): Y.XmlElement<WritebackBlock> {
  const prevAttributes = getWritebackAttributes(block)

  const nextAttributes: WritebackBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    dataframeName: prevAttributes.dataframeName,
    dataSourceId: prevAttributes.dataSourceId
      ? options?.datasourceMap?.get(prevAttributes.dataSourceId) ??
        prevAttributes.dataSourceId
      : null,
    tableName: duplicateYText(prevAttributes.tableName),
    overwriteTable: prevAttributes.overwriteTable,
    onConflict: prevAttributes.onConflict,
    onConflictColumns: prevAttributes.onConflictColumns,
    result: null,
    isCollapsed: prevAttributes.isCollapsed,
  }

  const yBlock = new Y.XmlElement<WritebackBlock>('block')
  for (const [key, value] of Object.entries(nextAttributes)) {
    yBlock.setAttribute(
      // @ts-ignore
      key,
      value
    )
  }

  return yBlock
}

export function getWritebackBlockExecutedAt(
  block: Y.XmlElement<WritebackBlock>
): Date | null {
  const result = block.getAttribute('result')
  if (result) {
    return new Date(result.executedAt)
  }

  return null
}

export function getValidationErrorMessage(
  reason: 'dataframe-not-found' | 'datasource-not-found' | 'invalid-table-name'
): string {
  switch (reason) {
    case 'dataframe-not-found':
      return 'Source dataframe not found.'
    case 'datasource-not-found':
      return 'Target data source not found.'
    case 'invalid-table-name':
      return 'Invalid table name.'
  }
}

export function getPrettyStep(step: WriteBackErrorResult['step']): string {
  switch (step) {
    case 'insert':
      return 'insertion'
    case undefined:
    case 'unknown':
      return 'unknown'
    case 'cleanup':
      return 'cleanup'
    case 'schema-inspection':
      return 'schema inspection'
    case 'validation':
      return 'validation'
  }
}

export function getWritebackBlockErrorMessage(
  block: Y.XmlElement<WritebackBlock>
): string | null {
  const result = block.getAttribute('result')
  if (result?._tag === 'error') {
    if (result.reason === 'python-error') {
      if (result.step === 'unknown') {
        return `Writeback failed, got ${result.ename}.`
      }

      const step = getPrettyStep(result.step)
      return `Writeback failed while performing ${step}, got ${result.ename}.`
    }

    if (result.reason === 'overwrite-empty-dataframe') {
      return 'Cannot overwrite table with empty dataframe.'
    }

    switch (result.step) {
      case 'validation': {
        if (result.reason === 'invalid-table-template') {
          return `${result.pythonError.ename}: ${result.pythonError.evalue}`
        }

        if (result.reason === 'invalid-conflict-columns') {
          return `Invalid conflict columns: ${result.columns.join(', ')}`
        }

        return getValidationErrorMessage(result.reason)
      }
      case 'schema-inspection':
        return 'Failed to inspect schema before writeback.'
      case 'cleanup':
        return 'Failed to clean up table before insertion.'
      case 'insert':
        return 'Failed to insert data into table.'
      case 'unknown':
        return 'Something went wrong during writeback.'
    }
  } else {
    return null
  }
}

export function getWritebackBlockExecStatus(
  block: Y.XmlElement<WritebackBlock>,
  executionQueue: ExecutionQueue
): ExecutionStatus {
  const blockId = getBaseAttributes(block).id
  const executions = executionQueue.getBlockExecutions(blockId, 'writeback')

  const execution = head(executions)
  if (execution) {
    return execution.item.getStatus()._tag
  }

  return 'completed'
}

export function getWritebackBlockResultStatus(
  block: Y.XmlElement<WritebackBlock>
): ResultStatus {
  const result = block.getAttribute('result')
  switch (result?._tag) {
    case 'success':
      return 'success'
    case 'error':
      return 'error'
    case undefined:
      return 'idle'
  }
}

export function isWritebackBlock(
  block: YBlock
): block is Y.XmlElement<WritebackBlock> {
  return block.getAttribute('type') === BlockType.Writeback
}
