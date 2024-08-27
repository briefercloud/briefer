import * as Y from 'yjs'
import { RunQueryResult } from '@briefer/types'
import {
  BlockType,
  BaseBlock,
  YBlock,
  ExecStatus,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
  duplicateYText,
} from './index.js'
import { updateYText } from '../index.js'
import { clone } from 'ramda'

export type DataframeName = {
  value: string
  newValue: string
  status: 'idle' | 'loading' | 'running'
  error?: 'invalid-name' | 'unexpected'
}

export type SQLBlock = BaseBlock<BlockType.SQL> & {
  source: Y.Text
  status:
    | 'idle'
    | 'run-requested'
    | 'try-suggestion-requested'
    | 'running'
    | 'running-suggestion'
    | 'abort-requested'
    | 'aborting'
    | 'run-all-enqueued'
    | 'run-all-running'
    | 'edit-with-ai-requested'
    | 'edit-with-ai-running'
    | 'fix-with-ai-requested'
    | 'fix-with-ai-running'
  dataframeName: DataframeName
  dataSourceId: string | null
  isFileDataSource: boolean
  result: RunQueryResult | null
  lastQuery: string | null
  lastQueryTime: string | null
  isCodeHidden: boolean
  isResultHidden: boolean
  editWithAIPrompt: Y.Text
  isEditWithAIPromptOpen: boolean
  aiSuggestions: Y.Text | null
}

export const isSQLBlock = (block: YBlock): block is Y.XmlElement<SQLBlock> => {
  return block.getAttribute('type') === BlockType.SQL
}

export const makeSQLBlock = (
  id: string,
  blocks: Y.Map<YBlock>,
  opts?: {
    dataSourceId?: string | null
    isFileDataSource?: boolean
    source?: string
  }
): Y.XmlElement<SQLBlock> => {
  const yBlock = new Y.XmlElement<SQLBlock>('block')
  const attrs: SQLBlock = {
    id: id,
    index: null,
    type: BlockType.SQL,
    title: '',
    source: new Y.Text(opts?.source ?? ''),
    status: 'idle',
    dataframeName: getDataframeName(blocks),
    dataSourceId: opts?.dataSourceId ?? null,
    isFileDataSource: opts?.isFileDataSource ?? false,
    result: null,
    lastQuery: null,
    lastQueryTime: null,
    isCodeHidden: false,
    isResultHidden: false,
    editWithAIPrompt: new Y.Text(''),
    isEditWithAIPromptOpen: false,
    aiSuggestions: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getSQLAttributes(
  block: Y.XmlElement<SQLBlock>,
  blocks: Y.Map<YBlock>
): SQLBlock {
  return {
    ...getBaseAttributes(block),
    source: getSQLSource(block),
    status: getAttributeOr(block, 'status', 'idle'),
    dataframeName: getAttributeOr(
      block,
      'dataframeName',
      getDataframeName(blocks)
    ),
    dataSourceId: getAttributeOr(block, 'dataSourceId', null),
    isFileDataSource: getAttributeOr(block, 'isFileDataSource', false),
    result: getAttributeOr(block, 'result', null),
    lastQuery: getAttributeOr(block, 'lastQuery', null),
    lastQueryTime: getAttributeOr(block, 'lastQueryTime', null),
    isCodeHidden: getAttributeOr(block, 'isCodeHidden', false),
    isResultHidden: getAttributeOr(block, 'isResultHidden', false),
    editWithAIPrompt: getSQLBlockEditWithAIPrompt(block),
    isEditWithAIPromptOpen: getAttributeOr(
      block,
      'isEditWithAIPromptOpen',
      false
    ),
    aiSuggestions: getSQLAISuggestions(block),
  }
}

export function duplicateSQLBlock(
  newId: string,
  block: Y.XmlElement<SQLBlock>,
  blocks: Y.Map<YBlock>,
  datasourceMap?: Map<string, string>
): Y.XmlElement<SQLBlock> {
  const prevAttributes = getSQLAttributes(block, blocks)

  const nextAttributes: SQLBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    source: duplicateYText(prevAttributes.source),
    status: prevAttributes.status,
    dataframeName: clone(prevAttributes.dataframeName),
    dataSourceId: prevAttributes.dataSourceId
      ? datasourceMap?.get(prevAttributes.dataSourceId) ??
        prevAttributes.dataSourceId
      : null,
    isFileDataSource: prevAttributes.isFileDataSource,
    result: clone(prevAttributes.result),
    lastQuery: prevAttributes.lastQuery,
    lastQueryTime: prevAttributes.lastQueryTime,
    isCodeHidden: prevAttributes.isCodeHidden,
    isResultHidden: prevAttributes.isResultHidden,
    editWithAIPrompt: duplicateYText(prevAttributes.editWithAIPrompt),
    isEditWithAIPromptOpen: prevAttributes.isEditWithAIPromptOpen,
    aiSuggestions: prevAttributes.aiSuggestions
      ? duplicateYText(prevAttributes.aiSuggestions)
      : null,
  }

  const yBlock = new Y.XmlElement<SQLBlock>('block')
  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getDataframeName(blocks: Y.Map<YBlock>): DataframeName {
  const sqlBlocks = Array.from(blocks.values()).filter(isSQLBlock)
  const names = new Set(
    sqlBlocks.map((block) => block.getAttribute('dataframeName')?.value)
  )

  let i = 1
  while (names.has(`query_${i}`)) {
    i++
  }

  return {
    value: `query_${i}`,
    newValue: `query_${i}`,
    status: 'idle',
  }
}

export function getSQLBlockExecStatus(
  block: Y.XmlElement<SQLBlock>
): ExecStatus {
  const status = block.getAttribute('status')
  switch (status) {
    case undefined:
    case 'idle':
    case 'edit-with-ai-requested':
    case 'edit-with-ai-running':
    case 'fix-with-ai-requested':
    case 'fix-with-ai-running':
      return getSQLBlockResultStatus(block)
    case 'run-all-enqueued':
      return 'enqueued'
    case 'run-requested':
    case 'try-suggestion-requested':
    case 'running':
    case 'running-suggestion':
    case 'abort-requested':
    case 'aborting':
    case 'run-all-running':
      return 'loading'
  }
}

export function getSQLBlockResultStatus(
  block: Y.XmlElement<SQLBlock>
): ExecStatus {
  const lastQueryTime = block.getAttribute('lastQueryTime')
  if (!lastQueryTime) {
    return 'idle'
  }

  const result = block.getAttribute('result')
  if (!result) {
    return 'idle'
  }

  switch (result.type) {
    case 'success':
      return 'success'
    case 'abort-error':
    case 'syntax-error':
    case 'python-error':
      return 'error'
  }
}

export function getSQLSource(block: Y.XmlElement<SQLBlock>): Y.Text {
  return getAttributeOr(block, 'source', new Y.Text(''))
}

export function getSQLAISuggestions(
  block: Y.XmlElement<SQLBlock>
): Y.Text | null {
  return getAttributeOr(block, 'aiSuggestions', null)
}

export function isSQLBlockAIEditing(block: Y.XmlElement<SQLBlock>): boolean {
  const status = block.getAttribute('status')
  switch (status) {
    case 'edit-with-ai-requested':
    case 'edit-with-ai-running':
      return true
    case 'idle':
    case 'run-requested':
    case 'try-suggestion-requested':
    case 'running':
    case 'running-suggestion':
    case 'abort-requested':
    case 'aborting':
    case 'run-all-enqueued':
    case 'run-all-running':
    case 'fix-with-ai-requested':
    case 'fix-with-ai-running':
    case undefined:
      return false
  }
}

export function getSQLBlockEditWithAIPrompt(
  block: Y.XmlElement<SQLBlock>
): Y.Text {
  return getAttributeOr(block, 'editWithAIPrompt', new Y.Text(''))
}

export function isSQLBlockEditWithAIPromptOpen(
  block: Y.XmlElement<SQLBlock>
): boolean {
  return getAttributeOr(block, 'isEditWithAIPromptOpen', false)
}

export function toggleSQLEditWithAIPromptOpen(block: Y.XmlElement<SQLBlock>) {
  const operation = () => {
    const isOpen = getAttributeOr(block, 'isEditWithAIPromptOpen', false)
    block.setAttribute('isEditWithAIPromptOpen', !isOpen)
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function closeSQLEditWithAIPrompt(
  block: Y.XmlElement<SQLBlock>,
  cleanPrompt: boolean
) {
  const opeartion = () => {
    const prompt = getSQLBlockEditWithAIPrompt(block)
    if (cleanPrompt) {
      prompt.delete(0, prompt.length)
    }

    block.setAttribute('isEditWithAIPromptOpen', false)
  }

  if (block.doc) {
    block.doc.transact(opeartion)
  } else {
    opeartion()
  }
}

export function requestSQLEditWithAI(block: Y.XmlElement<SQLBlock>) {
  block.setAttribute('status', 'edit-with-ai-requested')
}

export function updateSQLAISuggestions(
  block: Y.XmlElement<SQLBlock>,
  suggestions: string
) {
  const aiSuggestions = getSQLAISuggestions(block)
  if (!aiSuggestions) {
    block.setAttribute('aiSuggestions', new Y.Text(suggestions))
    return
  }

  updateYText(aiSuggestions, suggestions)
}

export function requestSQLFixWithAI(block: Y.XmlElement<SQLBlock>) {
  block.setAttribute('status', 'fix-with-ai-requested')
}

export function isFixingSQLWithAI(block: Y.XmlElement<SQLBlock>): boolean {
  const status = block.getAttribute('status')
  switch (status) {
    case 'fix-with-ai-requested':
    case 'fix-with-ai-running':
      return true
    case 'idle':
    case 'run-requested':
    case 'try-suggestion-requested':
    case 'running':
    case 'running-suggestion':
    case 'abort-requested':
    case 'aborting':
    case 'run-all-enqueued':
    case 'run-all-running':
    case 'edit-with-ai-requested':
    case 'edit-with-ai-running':
    case undefined:
      return false
  }
}

export function getSQLBlockExecutedAt(
  block: Y.XmlElement<SQLBlock>,
  blocks: Y.Map<YBlock>
): Date | null {
  const lastQueryTime = getSQLAttributes(block, blocks).lastQueryTime?.trim()
  if (!lastQueryTime) {
    return null
  }

  return new Date(lastQueryTime)
}

export function getSQLBlockIsDirty(
  block: Y.XmlElement<SQLBlock>,
  blocks: Y.Map<YBlock>
): boolean {
  const { lastQuery, source } = getSQLAttributes(block, blocks)

  return lastQuery !== source.toString()
}

export function getSQLBlockErrorMessage(
  block: Y.XmlElement<SQLBlock>
): string | null {
  const result = block.getAttribute('result')
  if (!result) {
    return null
  }

  switch (result.type) {
    case 'abort-error':
      return result.message
    case 'syntax-error':
      return result.message
    case 'python-error':
      return `${result.ename} - ${result.evalue}`
    case 'success':
      return null
  }
}
