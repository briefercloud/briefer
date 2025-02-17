import * as Y from 'yjs'
import {
  RunQueryResult,
  SQLQueryConfiguration,
  TableSort,
} from '@briefer/types'
import {
  BlockType,
  BaseBlock,
  YBlock,
  getAttributeOr,
  getBaseAttributes,
  duplicateBaseAttributes,
  duplicateYText,
} from './index.js'
import { ResultStatus, updateYText } from '../index.js'
import { clone } from 'ramda'

export type DataframeName = {
  value: string
  newValue: string
  error?: 'invalid-name' | 'unexpected'
}

export type SQLBlock = BaseBlock<BlockType.SQL> & {
  source: Y.Text
  dataframeName: DataframeName
  dataSourceId: string | null
  isFileDataSource: boolean
  result: RunQueryResult | null
  page: number
  dashboardPage: number
  dashboardPageSize: number
  lastQuery: string | null
  lastQueryTime: string | null
  startQueryTime: string | null
  isCodeHidden: boolean
  isResultHidden: boolean
  editWithAIPrompt: Y.Text
  isEditWithAIPromptOpen: boolean
  aiSuggestions: Y.Text | null
  configuration: SQLQueryConfiguration | null
  sort: TableSort | null

  // wether the block originated from a reusable component and the id of the component
  componentId: string | null
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
    dataframeName: getDataframeName(blocks, 'query_1'),
    dataSourceId: opts?.dataSourceId ?? null,
    isFileDataSource: opts?.isFileDataSource ?? false,
    result: null,
    page: 0,
    dashboardPage: 0,
    dashboardPageSize: 6,
    lastQuery: null,
    lastQueryTime: null,
    startQueryTime: null,
    isCodeHidden: false,
    isResultHidden: false,
    editWithAIPrompt: new Y.Text(''),
    isEditWithAIPromptOpen: false,
    aiSuggestions: null,
    componentId: null,
    configuration: null,
    sort: null,
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
    dataframeName: getAttributeOr(
      block,
      'dataframeName',
      getDataframeName(blocks, 'query_1')
    ),
    dataSourceId: getAttributeOr(block, 'dataSourceId', null),
    isFileDataSource: getAttributeOr(block, 'isFileDataSource', false),
    result: getAttributeOr(block, 'result', null),
    page: getAttributeOr(block, 'page', 0),
    dashboardPage: getAttributeOr(block, 'dashboardPage', 0),
    dashboardPageSize: getAttributeOr(block, 'dashboardPageSize', 6),
    lastQuery: getAttributeOr(block, 'lastQuery', null),
    lastQueryTime: getAttributeOr(block, 'lastQueryTime', null),
    startQueryTime: getAttributeOr(block, 'startQueryTime', null),
    isCodeHidden: getAttributeOr(block, 'isCodeHidden', false),
    isResultHidden: getAttributeOr(block, 'isResultHidden', false),
    editWithAIPrompt: getSQLBlockEditWithAIPrompt(block),
    isEditWithAIPromptOpen: getAttributeOr(
      block,
      'isEditWithAIPromptOpen',
      false
    ),
    aiSuggestions: getSQLAISuggestions(block),
    componentId: getAttributeOr(block, 'componentId', null),
    configuration: getAttributeOr(block, 'configuration', null),
    sort: getAttributeOr(block, 'sort', null),
  }
}

export function duplicateSQLBlock(
  newId: string,
  block: Y.XmlElement<SQLBlock>,
  blocks: Y.Map<YBlock>,
  options?: {
    datasourceMap?: Map<string, string>
    componentId?: string
    noState?: boolean
    newVariableName?: boolean
  }
): Y.XmlElement<SQLBlock> {
  const prevAttributes = getSQLAttributes(block, blocks)

  const nextAttributes: SQLBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    source: duplicateYText(prevAttributes.source),
    dataframeName: clone(prevAttributes.dataframeName),
    dataSourceId: prevAttributes.dataSourceId
      ? options?.datasourceMap?.get(prevAttributes.dataSourceId) ??
        prevAttributes.dataSourceId
      : null,
    isFileDataSource: prevAttributes.isFileDataSource,
    result: options?.noState ? null : clone(prevAttributes.result),
    page: prevAttributes.page,
    dashboardPage: prevAttributes.dashboardPage,
    dashboardPageSize: prevAttributes.dashboardPageSize,
    lastQuery: options?.noState ? null : prevAttributes.lastQuery,
    lastQueryTime: options?.noState ? null : prevAttributes.lastQueryTime,
    startQueryTime: options?.noState ? null : prevAttributes.startQueryTime,
    isCodeHidden: options?.noState ? false : prevAttributes.isCodeHidden,
    isResultHidden: options?.noState ? false : prevAttributes.isResultHidden,
    editWithAIPrompt: options?.noState
      ? new Y.Text()
      : duplicateYText(prevAttributes.editWithAIPrompt),
    isEditWithAIPromptOpen: options?.noState
      ? false
      : prevAttributes.isEditWithAIPromptOpen,
    aiSuggestions:
      prevAttributes.aiSuggestions && !options?.noState
        ? duplicateYText(prevAttributes.aiSuggestions)
        : null,
    componentId: options?.componentId ?? prevAttributes.componentId,
    configuration: clone(prevAttributes.configuration),
    sort: clone(prevAttributes.sort),
  }

  if (options?.newVariableName) {
    const name = getDataframeName(
      blocks,
      `${nextAttributes.dataframeName.value}`
    )
    nextAttributes.dataframeName.value = name.value
    nextAttributes.dataframeName.newValue = name.newValue
  }

  const yBlock = new Y.XmlElement<SQLBlock>('block')
  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getDataframeName(
  blocks: Y.Map<YBlock>,
  prefix: string
): DataframeName {
  const sqlBlocks = Array.from(blocks.values()).filter(isSQLBlock)
  const names = new Set(
    sqlBlocks.map((block) => block.getAttribute('dataframeName')?.value)
  )

  const lastPartStr = prefix.split('_').pop()
  const lastPart = lastPartStr ? parseInt(lastPartStr) : 0
  let i = Number.isNaN(lastPart) ? 1 : lastPart
  if (!Number.isNaN(lastPart)) {
    // remove last _{i} part from prefix
    prefix = prefix.split('_').slice(0, -1).join('_')
  }

  while (names.has(`${prefix}_${i}`)) {
    i++
  }

  return {
    value: `${prefix}_${i}`,
    newValue: `${prefix}_${i}`,
  }
}

export function getSQLBlockResultStatus(
  block: Y.XmlElement<SQLBlock>
): ResultStatus {
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
