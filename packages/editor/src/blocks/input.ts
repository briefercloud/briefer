import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  getAttributeOr,
  getBaseAttributes,
  ExecStatus,
  duplicateBaseAttributes,
} from './index.js'
import { clone } from 'ramda'

export type EditableField<E, S = never, V = string> = {
  status: 'idle' | 'save-requested' | 'saving' | S
  value: V
  newValue: V
  error: E | null
}

export type InputBlock = BaseBlock<BlockType.Input> & {
  label: string
  value: EditableField<
    'invalid-value' | 'unexpected-error',
    'run-all-enqueued' | 'run-all-running'
  >
  variable: EditableField<
    'invalid-value' | 'invalid-variable-name' | 'unexpected-error'
  >
  inputType: 'text'
  executedAt: string | null
}

export const isTextInputBlock = (
  block: YBlock
): block is Y.XmlElement<InputBlock> =>
  block.getAttribute('type') === BlockType.Input

export const makeInputBlock = (
  id: string,
  blocks: Y.Map<YBlock>
): Y.XmlElement<InputBlock> => {
  const yBlock = new Y.XmlElement<InputBlock>('block')

  const variable = getAvailableInputVariable(blocks)

  const attrs: InputBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.Input,
    label: getInputLabel(yBlock, variable.value),
    value: {
      value: '',
      newValue: '',
      status: 'idle',
      error: null,
    },
    variable,
    inputType: 'text',
    executedAt: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getInputAttributes(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): InputBlock {
  const variable = getAttributeOr(
    block,
    'variable',
    getAvailableInputVariable(blocks)
  )
  const label = getInputLabel(block, variable.value)
  const value = getInputValue(block)

  const inputType = getAttributeOr(block, 'inputType', 'text')

  return {
    ...getBaseAttributes<BlockType.Input>(block),
    variable,
    label,
    value,
    inputType,
    executedAt: getAttributeOr(block, 'executedAt', null),
  }
}

export function duplicateInputBlock(
  newId: string,
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): Y.XmlElement<InputBlock> {
  const prevAttributes = getInputAttributes(block, blocks)

  const nextAttributes: InputBlock = {
    ...duplicateBaseAttributes(newId, prevAttributes),
    label: prevAttributes.label,
    value: clone(prevAttributes.value),
    variable: clone(prevAttributes.variable),
    inputType: prevAttributes.inputType,
    executedAt: null,
  }

  const yBlock = new Y.XmlElement<InputBlock>('block')

  for (const [key, value] of Object.entries(nextAttributes)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getInputLabel(
  block: Y.XmlElement<InputBlock>,
  variable: string | null
): InputBlock['label'] {
  const fallback = variable
    ? variable.charAt(0).toUpperCase() + variable.slice(1).replace('_', ' ')
    : 'Input'

  return getAttributeOr(block, 'label', fallback)
}

export function updateInputLabel(
  block: Y.XmlElement<InputBlock>,
  newValue: string
): void {
  block.setAttribute('label', newValue)
}

function getInputValue(block: Y.XmlElement<InputBlock>): InputBlock['value'] {
  return getAttributeOr(block, 'value', {
    value: '',
    newValue: '',
    status: 'idle',
    error: null,
  })
}

export function updateInputValue(
  block: Y.XmlElement<InputBlock>,
  newValue: Partial<InputBlock['value']>
): void {
  const currentValue = getInputValue(block)

  block.setAttribute('value', {
    ...currentValue,
    ...newValue,
  })
}

export function getInputValueExecStatus(
  block: Y.XmlElement<InputBlock>
): ExecStatus {
  const value = getInputValue(block)
  switch (value.status) {
    case 'idle':
      return value.error ? 'error' : 'idle'
    case 'run-all-enqueued':
      return 'enqueued'
    case 'save-requested':
    case 'saving':
    case 'run-all-running':
      return 'loading'
  }
}

function getInputVariable(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): InputBlock['variable'] {
  const variable = getAttributeOr(
    block,
    'variable',
    getAvailableInputVariable(blocks)
  )

  return variable
}

export function updateInputVariable(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>,
  newValue: Partial<InputBlock['variable']>
): void {
  const currentValue = getInputVariable(block, blocks)

  block.setAttribute('variable', {
    ...currentValue,
    ...newValue,
  })
}

export function getInputVariableExecStatus(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): ExecStatus {
  const variable = getInputVariable(block, blocks)
  switch (variable.status) {
    case 'idle':
      return variable.error ? 'error' : 'idle'
    case 'save-requested':
    case 'saving':
      return 'loading'
  }
}

export function getInputBlockExecStatus(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): ExecStatus {
  const variableStatus = getInputVariableExecStatus(block, blocks)

  switch (variableStatus) {
    case 'success':
    case 'idle':
      return getInputValueExecStatus(block)
    case 'loading':
    case 'enqueued':
      return 'loading'
    case 'error':
      return 'error'
  }
}

function getAvailableInputVariable(
  blocks: Y.Map<YBlock>
): InputBlock['variable'] {
  const inputBlocks = Array.from(blocks.values()).filter(isTextInputBlock)
  const vars = new Set(
    inputBlocks.map((block) => block.getAttribute('variable')?.value)
  )

  let i = 1
  while (vars.has(`input_${i}`)) {
    i++
  }

  return {
    value: `input_${i}`,
    newValue: `input_${i}`,
    status: 'idle',
    error: null,
  }
}

export function inputRequestSaveValue(
  block: Y.XmlElement<InputBlock>,
  status?: 'saving' | 'save-requested'
): void {
  const operation = () => {
    const oldVal = block.getAttribute('value')
    if (!oldVal) {
      return
    }

    block.setAttribute('value', {
      ...oldVal,
      status: status ?? 'save-requested',
    })
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function getInputBlockExecutedAt(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): Date | null {
  const executedAt = getInputAttributes(block, blocks).executedAt?.trim()
  if (!executedAt) {
    return null
  }

  return new Date(executedAt)
}

export function getInputBlockIsDirty(
  block: Y.XmlElement<InputBlock>,
  blocks: Y.Map<YBlock>
): boolean {
  const { value, variable } = getInputAttributes(block, blocks)
  return value.value !== value.newValue || variable.value !== variable.newValue
}

export function updateInputBlockExecutedAt(
  block: Y.XmlElement<InputBlock>,
  executedAt: Date | null
): void {
  block.setAttribute('executedAt', executedAt?.toISOString() ?? null)
}
