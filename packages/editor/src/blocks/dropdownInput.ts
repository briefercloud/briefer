import { clone, head, uniq } from 'ramda'
import * as Y from 'yjs'
import {
  BlockType,
  BaseBlock,
  YBlock,
  getAttributeOr,
  getBaseAttributes,
  EditableField,
  duplicateBaseAttributes,
  ResultStatus,
} from './index.js'
import { ExecutionStatus } from '../execution/item.js'
import { ExecutionQueue } from '../execution/queue.js'

export type DropdownType = 'static' | 'dynamic'

export type DropdownInputBlock = BaseBlock<BlockType.DropdownInput> & {
  label: string
  value: EditableField<'invalid-value' | 'unexpected-error', string | null>
  variable: EditableField<
    'invalid-value' | 'invalid-variable-name' | 'unexpected-error'
  >
  configOpen: boolean
  executedAt: string | null
  dropdownType: DropdownType
  options: string[]
  dataframeName: string | null
  columnName: string | null
}

export const isDropdownInputBlock = (
  block: YBlock
): block is Y.XmlElement<DropdownInputBlock> =>
  block.getAttribute('type') === BlockType.DropdownInput

export const makeDropdownInputBlock = (
  id: string,
  blocks: Y.Map<YBlock>
): Y.XmlElement<DropdownInputBlock> => {
  const yBlock = new Y.XmlElement<DropdownInputBlock>('block')

  const variable = getDropdownInputVariable(yBlock, blocks)
  const attrs: DropdownInputBlock = {
    id,
    index: null,
    title: '',
    type: BlockType.DropdownInput,
    label: getDropdownInputLabel(yBlock, variable.value),
    value: {
      value: null,
      newValue: null,
      error: null,
    },
    variable,
    dropdownType: 'static',
    options: [],
    configOpen: true,
    executedAt: null,
    dataframeName: null,
    columnName: null,
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

export function getDropdownInputAttributes(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): DropdownInputBlock {
  const variable = getAttributeOr(
    block,
    'variable',
    getAvailableDropdownInputVariable(blocks)
  )
  const label = getDropdownInputLabel(block, variable.value)
  const value = getDropdownInputValue(block)
  const options = getAttributeOr(block, 'options', [])
  const configOpen = getAttributeOr(block, 'configOpen', false)
  const dropdownType = getAttributeOr(block, 'dropdownType', 'static')
  const dataframeName = getAttributeOr(block, 'dataframeName', null)
  const columnName = getAttributeOr(block, 'columnName', null)

  return {
    ...getBaseAttributes<BlockType.DropdownInput>(block),
    variable,
    label,
    value,
    options,
    configOpen,
    dropdownType,
    dataframeName,
    columnName,
    executedAt: getAttributeOr(block, 'executedAt', null),
  }
}

export function duplicateDropdownInputBlock(
  newId: string,
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): Y.XmlElement<DropdownInputBlock> {
  const prevAttrs = getDropdownInputAttributes(block, blocks)

  const nextAttrs: DropdownInputBlock = {
    ...duplicateBaseAttributes(newId, prevAttrs),
    variable: clone(prevAttrs.variable),
    label: prevAttrs.label,
    value: clone(prevAttrs.value),
    options: clone(prevAttrs.options),
    configOpen: prevAttrs.configOpen,
    executedAt: null,
    dropdownType: prevAttrs.dropdownType,
    dataframeName: prevAttrs.dataframeName,
    columnName: prevAttrs.columnName,
  }

  const yBlock = new Y.XmlElement<DropdownInputBlock>('block')
  for (const [key, value] of Object.entries(nextAttrs)) {
    // @ts-ignore
    yBlock.setAttribute(key, value)
  }

  return yBlock
}

function getDropdownInputLabel(
  block: Y.XmlElement<DropdownInputBlock>,
  variable: string | null
): DropdownInputBlock['label'] {
  const fallback = variable
    ? variable.charAt(0).toUpperCase() + variable.slice(1).replace('_', ' ')
    : 'Dropdown Input'

  return getAttributeOr(block, 'label', fallback)
}

export function updateDropdownInputLabel(
  block: Y.XmlElement<DropdownInputBlock>,
  newValue: string
): void {
  block.setAttribute('label', newValue)
}

function getDropdownInputValue(
  block: Y.XmlElement<DropdownInputBlock>
): DropdownInputBlock['value'] {
  return getAttributeOr(block, 'value', {
    value: '',
    newValue: '',
    error: null,
  })
}

export function updateDropdownInputValue(
  block: Y.XmlElement<DropdownInputBlock>,
  value: Partial<DropdownInputBlock['value']>
): void {
  const operation = () => {
    const prevValue = getDropdownInputValue(block)
    const options = getAttributeOr(block, 'options', [])
    let newValue: string | null = value.newValue ?? prevValue.newValue
    if (newValue !== null && !options.includes(newValue)) {
      newValue = null
    }

    block.setAttribute('value', {
      ...prevValue,
      ...value,
      newValue,
    })
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

export function getDropdownInputValueExecStatus(
  block: Y.XmlElement<DropdownInputBlock>,
  executionQueue: ExecutionQueue
): ExecutionStatus {
  const blockId = getBaseAttributes(block).id
  const executions = executionQueue.getBlockExecutions(
    blockId,
    'dropdown-input-save-value'
  )
  const execution = head(executions)
  if (execution) {
    return execution.item.getStatus()._tag
  }

  return 'completed'
}

function getDropdownInputVariable(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): DropdownInputBlock['variable'] {
  const variable = getAttributeOr(
    block,
    'variable',
    getAvailableDropdownInputVariable(blocks)
  )

  return variable
}

export function updateDropdownInputVariable(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>,
  newValue: Partial<DropdownInputBlock['variable']>
): void {
  const currentValue = getDropdownInputVariable(block, blocks)

  block.setAttribute('variable', {
    ...currentValue,
    ...newValue,
  })
}

export function getDropdownInputVariableExecStatus(
  block: Y.XmlElement<DropdownInputBlock>,
  executionQueue: ExecutionQueue
): ExecutionStatus {
  const blockId = getBaseAttributes(block).id
  const executions = executionQueue.getBlockExecutions(
    blockId,
    'dropdown-input-rename-variable'
  )

  const execution = head(executions)

  if (!execution) {
    return 'completed'
  }

  return execution.item.getStatus()._tag
}

export function getDropdownInputBlockExecStatus(
  block: Y.XmlElement<DropdownInputBlock>,
  executionQueue: ExecutionQueue
): ExecutionStatus {
  const variableStatus = getDropdownInputVariableExecStatus(
    block,
    executionQueue
  )

  switch (variableStatus) {
    case 'running':
    case 'aborting':
    case 'enqueued':
      return variableStatus
    case 'completed':
    case 'unknown':
    case 'idle':
      return getDropdownInputValueExecStatus(block, executionQueue)
  }
}

function getAvailableDropdownInputVariable(
  blocks: Y.Map<YBlock>
): DropdownInputBlock['variable'] {
  const inputBlocks = Array.from(blocks.values()).filter(isDropdownInputBlock)
  const vars = new Set(
    inputBlocks.map((block) => block.getAttribute('variable')?.value)
  )

  let i = 1
  while (vars.has(`dropdown_${i}`)) {
    i++
  }

  return {
    value: `dropdown_${i}`,
    newValue: `dropdown_${i}`,
    error: null,
  }
}

export function dropdownInputToggleConfigOpen(
  block: Y.XmlElement<DropdownInputBlock>
): void {
  const operation = () => {
    const configOpen = block.getAttribute('configOpen')
    block.setAttribute('configOpen', !configOpen)
  }

  if (block.doc) {
    block.doc.transact(operation)
  } else {
    operation()
  }
}

// returns true if value was updated
export function removeDropdownInputOption(
  block: Y.XmlElement<DropdownInputBlock>,
  option: string
): boolean {
  const operation = () => {
    const value = getDropdownInputValue(block)
    const options = getAttributeOr(block, 'options', [])
    block.setAttribute(
      'options',
      options.filter((o) => o !== option)
    )
    if (value.newValue === option) {
      updateDropdownInputValue(block, {
        ...value,
        newValue: null,
        error: null,
      })
      return true
    }

    return false
  }

  if (block.doc) {
    return block.doc.transact(operation)
  }
  return operation()
}

// returns true if value was updated
export function appendDropdownInputOptions(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>,
  newOptions: string[],
  replace: boolean
): boolean {
  const operation = () => {
    const { options, value } = getDropdownInputAttributes(block, blocks)

    if (replace) {
      block.setAttribute('options', newOptions)
    } else {
      block.setAttribute('options', uniq([...options, ...newOptions]))
    }

    if (value.newValue === null) {
      updateDropdownInputValue(block, {
        ...value,
        newValue: newOptions.length === 0 ? null : newOptions[0],
        error: null,
      })
      return true
    }

    return false
  }

  if (block.doc) {
    return block.doc.transact(operation)
  }

  return operation()
}

export function getDropdownInputBlockExecutedAt(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): Date | null {
  const executedAt = getDropdownInputAttributes(
    block,
    blocks
  ).executedAt?.trim()
  if (!executedAt) {
    return null
  }

  return new Date(executedAt)
}

export function getDropdownInputBlockIsDirty(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): boolean {
  const { value, variable } = getDropdownInputAttributes(block, blocks)
  return value.value !== value.newValue || variable.value !== variable.newValue
}

export function updateDropdownInputBlockExecutedAt(
  block: Y.XmlElement<DropdownInputBlock>,
  executedAt: Date | null
): void {
  block.setAttribute('executedAt', executedAt?.toISOString() ?? null)
}

export function setDropdownType(
  block: Y.XmlElement<DropdownInputBlock>,
  type: DropdownType
) {
  const operation = () => {
    block.setAttribute('dropdownType', type)
    block.setAttribute('dataframeName', null)
    block.setAttribute('columnName', null)
    block.setAttribute('options', [])
  }

  if (block.doc) {
    return block.doc.transact(operation)
  }

  return operation()
}

export function setDropdownDataFrameName(
  block: Y.XmlElement<DropdownInputBlock>,
  name: string | null
) {
  block.setAttribute('dataframeName', name)
}

export function setDropdownColumnName(
  block: Y.XmlElement<DropdownInputBlock>,
  name: string | null
) {
  block.setAttribute('columnName', name)
}

export function getDropdownInputBlockResultStatus(
  block: Y.XmlElement<DropdownInputBlock>,
  blocks: Y.Map<YBlock>
): ResultStatus {
  const variable = getDropdownInputVariable(block, blocks)
  const value = getDropdownInputValue(block)

  if (variable.error || value.error) {
    return 'error'
  }

  return value.error ? 'error' : 'success'
}
