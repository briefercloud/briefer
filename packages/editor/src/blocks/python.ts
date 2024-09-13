import * as Y from 'yjs'
import { Output } from '@briefer/types'
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

export type PythonBlock = BaseBlock<BlockType.Python> & {
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
  result: Output[]
  isResultHidden: boolean
  isCodeHidden: boolean
  lastQuery: string
  lastQueryTime: string
  editWithAIPrompt: Y.Text
  isEditWithAIPromptOpen: boolean
  aiSuggestions: Y.Text | null
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
    status: 'idle',
    result: [],
    isResultHidden: false,
    isCodeHidden: false,
    lastQuery: '',
    lastQueryTime: '',
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

export function getPythonAttributes(
  block: Y.XmlElement<PythonBlock>
): PythonBlock {
  return {
    ...getBaseAttributes(block),
    source: getPythonSource(block),
    status: getAttributeOr(block, 'status', 'idle'),
    result: getPythonBlockResult(block),
    isResultHidden: getAttributeOr(block, 'isResultHidden', false),
    isCodeHidden: getAttributeOr(block, 'isCodeHidden', false),
    lastQuery: getAttributeOr(block, 'lastQuery', ''),
    lastQueryTime: getAttributeOr(block, 'lastQueryTime', ''),
    editWithAIPrompt: getPythonBlockEditWithAIPrompt(block),
    isEditWithAIPromptOpen: isPythonBlockEditWithAIPromptOpen(block),
    aiSuggestions: getPythonAISuggestions(block),
  }
}

export function duplicatePythonBlock(
  newId: string,
  block: Y.XmlElement<PythonBlock>
): Y.XmlElement<PythonBlock> {
  const prevAttributes = getPythonAttributes(block)

  const nextAttributes: PythonBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    source: duplicateYText(prevAttributes.source),
    status: prevAttributes.status,
    result: clone(prevAttributes.result),
    isResultHidden: prevAttributes.isResultHidden,
    isCodeHidden: prevAttributes.isCodeHidden,
    lastQuery: prevAttributes.lastQuery,
    lastQueryTime: prevAttributes.lastQueryTime,
    editWithAIPrompt: duplicateYText(prevAttributes.editWithAIPrompt),
    isEditWithAIPromptOpen: prevAttributes.isEditWithAIPromptOpen,
    aiSuggestions: prevAttributes.aiSuggestions
      ? duplicateYText(prevAttributes.aiSuggestions)
      : null,
  }

  const yBlock = new Y.XmlElement<PythonBlock>('block')
  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getPythonBlockExecStatus(
  block: Y.XmlElement<PythonBlock>
): ExecStatus {
  const status = block.getAttribute('status')
  switch (status) {
    case undefined:
    case 'idle':
    case 'edit-with-ai-requested':
    case 'edit-with-ai-running':
    case 'fix-with-ai-requested':
    case 'fix-with-ai-running':
      return getPythonBlockResultStatus(block)
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

export function getPythonBlockResultStatus(
  block: Y.XmlElement<PythonBlock>
): ExecStatus {
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

export function isPythonBlockAIEditing(
  block: Y.XmlElement<PythonBlock>
): boolean {
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
  const operation = () => {
    const prompt = getPythonBlockEditWithAIPrompt(block)
    if (cleanPrompt) {
      prompt.delete(0, prompt.length)
    }

    block.setAttribute('isEditWithAIPromptOpen', false)
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function requestPythonEditWithAI(block: Y.XmlElement<PythonBlock>) {
  block.setAttribute('status', 'edit-with-ai-requested')
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

export function requestPythonFixWithAI(block: Y.XmlElement<PythonBlock>) {
  block.setAttribute('status', 'fix-with-ai-requested')
}

export function isFixingPythonWithAI(
  block: Y.XmlElement<PythonBlock>
): boolean {
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
