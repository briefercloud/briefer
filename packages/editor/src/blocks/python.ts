import * as Y from 'yjs'
import { Output } from '@briefer/types'
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

export type PythonBlock = BaseBlock<BlockType.Python> & {
  source: Y.Text
  result: Output[]
  isResultHidden: boolean
  isCodeHidden: boolean
  lastQuery: string
  lastQueryTime: string
  startQueryTime: string
  editWithAIPrompt: Y.Text
  isEditWithAIPromptOpen: boolean
  aiSuggestions: Y.Text | null
  componentId: string | null
}
export const isPythonBlock = (
  block: YBlock
): block is Y.XmlElement<PythonBlock> =>
  block.getAttribute('type') === BlockType.Python

export const makePythonBlock = (
  id: string,
  options?: { source?: string }
): Y.XmlElement<PythonBlock> => {
  const yBlock = new Y.XmlElement<PythonBlock>('block')
  const attrs: PythonBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.Python,
    source: new Y.Text(options?.source ?? ''),
    result: [],
    isResultHidden: false,
    isCodeHidden: false,
    lastQuery: '',
    lastQueryTime: '',
    startQueryTime: '',
    editWithAIPrompt: new Y.Text(''),
    isEditWithAIPromptOpen: false,
    aiSuggestions: null,
    componentId: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getPythonAttributes(
  block: Y.XmlElement<PythonBlock>
): PythonBlock {
  return {
    ...getBaseAttributes(block),
    source: getPythonSource(block),
    result: getPythonBlockResult(block),
    isResultHidden: getAttributeOr(block, 'isResultHidden', false),
    isCodeHidden: getAttributeOr(block, 'isCodeHidden', false),
    lastQuery: getAttributeOr(block, 'lastQuery', ''),
    lastQueryTime: getAttributeOr(block, 'lastQueryTime', ''),
    startQueryTime: getAttributeOr(block, 'startQueryTime', ''),
    editWithAIPrompt: getPythonBlockEditWithAIPrompt(block),
    isEditWithAIPromptOpen: isPythonBlockEditWithAIPromptOpen(block),
    aiSuggestions: getPythonAISuggestions(block),
    componentId: getAttributeOr(block, 'componentId', null),
  }
}

export function duplicatePythonBlock(
  newId: string,
  block: Y.XmlElement<PythonBlock>,
  options?: { componentId?: string; noState?: boolean }
): Y.XmlElement<PythonBlock> {
  const prevAttributes = getPythonAttributes(block)

  const nextAttributes: PythonBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    source: duplicateYText(prevAttributes.source),
    result: options?.noState ? [] : clone(prevAttributes.result),
    isResultHidden: options?.noState ? false : prevAttributes.isResultHidden,
    isCodeHidden: options?.noState ? false : prevAttributes.isCodeHidden,
    lastQuery: options?.noState ? '' : prevAttributes.lastQuery,
    lastQueryTime: options?.noState ? '' : prevAttributes.lastQueryTime,
    startQueryTime: options?.noState ? '' : prevAttributes.startQueryTime,
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
  }

  const yBlock = new Y.XmlElement<PythonBlock>('block')
  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getPythonBlockResultStatus(
  block: Y.XmlElement<PythonBlock>
): ResultStatus {
  const lastQueryTime = block.getAttribute('lastQueryTime')
  if (!lastQueryTime) {
    return 'idle'
  }

  const result = block.getAttribute('result')
  if (!result) {
    return 'idle'
  }

  const hasError = result.some((output) => output.type === 'error')
  if (hasError) {
    return 'error'
  }

  return 'success'
}

export function getPythonSource(block: Y.XmlElement<PythonBlock>): Y.Text {
  return getAttributeOr(block, 'source', new Y.Text(''))
}

export function getPythonAISuggestions(
  block: Y.XmlElement<PythonBlock>
): Y.Text | null {
  return getAttributeOr(block, 'aiSuggestions', null)
}

export function getPythonBlockEditWithAIPrompt(
  block: Y.XmlElement<PythonBlock>
): Y.Text {
  return getAttributeOr(block, 'editWithAIPrompt', new Y.Text(''))
}

export function isPythonBlockEditWithAIPromptOpen(
  block: Y.XmlElement<PythonBlock>
): boolean {
  return getAttributeOr(block, 'isEditWithAIPromptOpen', false)
}

export function togglePythonEditWithAIPromptOpen(
  block: Y.XmlElement<PythonBlock>
) {
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

export function closePythonEditWithAIPrompt(
  block: Y.XmlElement<PythonBlock>,
  cleanPrompt: boolean
) {
  const opeartion = () => {
    const prompt = getPythonBlockEditWithAIPrompt(block)
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

export function updatePythonAISuggestions(
  block: Y.XmlElement<PythonBlock>,
  suggestions: string
) {
  const aiSuggestions = getPythonAISuggestions(block)
  if (!aiSuggestions) {
    block.setAttribute('aiSuggestions', new Y.Text(suggestions))
    return
  }

  updateYText(aiSuggestions, suggestions)
}

export function getPythonBlockResult(
  block: Y.XmlElement<PythonBlock>
): Output[] {
  return getAttributeOr(block, 'result', [])
}

export function getPythonBlockExecutedAt(
  block: Y.XmlElement<PythonBlock>
): Date | null {
  const lastQueryTime = getPythonAttributes(block).lastQueryTime.trim()
  if (lastQueryTime === '') {
    return null
  }

  return new Date(lastQueryTime)
}

export function getPythonBlockIsDirty(
  block: Y.XmlElement<PythonBlock>
): boolean {
  const { source, lastQuery } = getPythonAttributes(block)
  return source.toString() !== lastQuery
}

export function getPythonBlockErrorMessage(
  block: Y.XmlElement<PythonBlock>
): string | null {
  const result = getPythonBlockResult(block)
  const errorOutput = result.find((output) => output.type === 'error')
  if (errorOutput && errorOutput.type === 'error') {
    return `${errorOutput.ename} - ${errorOutput.evalue}`
  }

  return null
}
