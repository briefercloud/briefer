import * as dfns from 'date-fns'
import * as Y from 'yjs'
import {
  RichTextBlock,
  duplicateRichTextBlock,
  getRichTextBlockExecStatus,
} from './richText.js'
import {
  SQLBlock,
  duplicateSQLBlock,
  getSQLBlockErrorMessage,
  getSQLBlockExecStatus,
  getSQLBlockExecutedAt,
  getSQLBlockResultStatus,
} from './sql.js'
import {
  PythonBlock,
  duplicatePythonBlock,
  getPythonBlockErrorMessage,
  getPythonBlockExecStatus,
  getPythonBlockExecutedAt,
  getPythonBlockResultStatus,
} from './python.js'
import {
  VisualizationBlock,
  duplicateVisualizationBlock,
  getVisualizationBlockErrorMessage,
  getVisualizationBlockExecStatus,
  getVisualizationBlockExecutedAt,
  getVisualizationBlockResultStatus,
} from './visualization.js'
import {
  InputBlock,
  duplicateInputBlock,
  getInputBlockExecStatus,
  getInputBlockExecutedAt,
  inputRequestSaveValue,
} from './input.js'
import { YBlockGroup, switchBlockType } from '../index.js'
import { FileUploadBlock, duplicateFileUploadBlock } from './fileUpload.js'
import {
  DropdownInputBlock,
  dropdownInputRequestSaveValue,
  duplicateDropdownInputBlock,
  getDropdownInputBlockExecStatus,
  getDropdownInputBlockExecutedAt,
} from './dropdownInput.js'
import { clone } from 'ramda'
import {
  DashboardHeaderBlock,
  duplicateDashboardHeaderBlock,
} from './dashboard.js'
import {
  WritebackBlock,
  duplicateWritebackBlock,
  getWritebackBlockErrorMessage,
  getWritebackBlockExecStatus,
  getWritebackBlockExecutedAt,
  getWritebackBlockResultStatus,
} from './writeback.js'
import {
  DateInputBlock,
  duplicateDateInputBlock,
  getDateInputBlockExecStatus,
  getDateInputBlockExecutedAt,
  requestDateInputRun,
} from './dateInput.js'
import {
  PivotTableBlock,
  duplicatePivotTableBlock,
  getPivotTableBlockErrorMessage,
  getPivotTableBlockExecStatus,
  getPivotTableBlockExecutedAt,
  getPivotTableBlockResultStatus,
} from './pivotTable.js'

export enum BlockType {
  RichText = 'RICH_TEXT',
  SQL = 'SQL',
  Python = 'PYTHON',
  Visualization = 'VISUALIZATION',
  Input = 'INPUT',
  DropdownInput = 'DROPDOWN_INPUT',
  DateInput = 'DATE_INPUT',
  FileUpload = 'FILE_UPLOAD',
  DashboardHeader = 'DASHBOARD_HEADER',
  Writeback = 'WRITEBACK',
  PivotTable = 'PIVOT_TABLE',
}

export type ExecStatus = 'enqueued' | 'loading' | 'idle' | 'error' | 'success'

export type BaseBlock<T extends BlockType> = {
  id: string
  index: number | null
  title: string
  type: T
}

export type Block =
  | RichTextBlock
  | SQLBlock
  | PythonBlock
  | VisualizationBlock
  | InputBlock
  | DropdownInputBlock
  | DateInputBlock
  | FileUploadBlock
  | DashboardHeaderBlock
  | WritebackBlock
  | PivotTableBlock

export type YBlock = Y.XmlElement<Block>

const noop = () => {}

export const requestRun = <B extends YBlock>(
  block: B,
  blocks: Y.Map<YBlock>,
  layout: Y.Array<YBlockGroup>,
  environmentStartedAt: Date | null,
  skipDependencyCheck: boolean,
  customOnRequestRun?: (block: B) => void
) => {
  const dependencies = skipDependencyCheck
    ? []
    : computeDepencyQueue(block, layout, blocks, environmentStartedAt)

  const queue = dependencies
  if (!customOnRequestRun) {
    queue.push(block)
  }
  for (const block of queue) {
    switchBlockType<void>(block, {
      onPython: (b) => b.setAttribute('status', 'run-requested'),
      onSQL: (b) => b.setAttribute('status', 'run-requested'),
      onVisualization: (b) => b.setAttribute('status', 'run-requested'),
      onWriteback: (b) => b.setAttribute('status', 'run-requested'),
      onInput: inputRequestSaveValue,
      onDropdownInput: dropdownInputRequestSaveValue,
      onDateInput: (b) => requestDateInputRun(b, blocks),
      onRichText: noop,
      onFileUpload: noop,
      onDashboardHeader: noop,
      onPivotTable: (b) => b.setAttribute('status', 'run-requested'),
    })
  }

  if (customOnRequestRun) {
    customOnRequestRun(block)
  }
}

export const requestTrySuggestion = (
  block: YBlock,
  blocks: Y.Map<YBlock>,
  layout: Y.Array<YBlockGroup>,
  environmentStartedAt: Date | null,
  skipDependencyCheck = false
) => {
  const dependencies = skipDependencyCheck
    ? []
    : computeDepencyQueue(block, layout, blocks, environmentStartedAt)
  const queue = dependencies.concat(block)

  for (const block of queue) {
    switchBlockType<void>(block, {
      onPython: (b) => b.setAttribute('status', 'try-suggestion-requested'),
      onSQL: (b) => b.setAttribute('status', 'try-suggestion-requested'),
      onVisualization: noop,
      onInput: inputRequestSaveValue,
      onDropdownInput: dropdownInputRequestSaveValue,
      onDateInput: (b) => b.setAttribute('status', 'run-requested'),
      onRichText: noop,
      onFileUpload: noop,
      onDashboardHeader: noop,
      onWriteback: noop,
      onPivotTable: noop,
    })
  }
}

export const setTitle = (block: YBlock, title: string) => {
  block.setAttribute('title', title)
}

export const getExecStatus = (
  block: YBlock,
  blocks: Y.Map<YBlock>
): ExecStatus =>
  switchBlockType(block, {
    onPython: getPythonBlockExecStatus,
    onSQL: getSQLBlockExecStatus,
    onVisualization: getVisualizationBlockExecStatus,
    onInput: (block) => getInputBlockExecStatus(block, blocks),
    onDropdownInput: (block) => getDropdownInputBlockExecStatus(block, blocks),
    onDateInput: (block) => getDateInputBlockExecStatus(block),
    onRichText: getRichTextBlockExecStatus,
    onFileUpload: () => 'idle',
    onDashboardHeader: () => 'idle',
    onWriteback: getWritebackBlockExecStatus,
    onPivotTable: getPivotTableBlockExecStatus,
  })

export const execStatusIsDisabled = (status: ExecStatus): boolean => {
  switch (status) {
    case 'enqueued':
    case 'loading':
      return true
    case 'idle':
    case 'error':
    case 'success':
      return false
  }
}

export const getResultStatus = (
  block: YBlock,
  blocks: Y.Map<YBlock>
): ExecStatus =>
  switchBlockType(block, {
    onPython: getPythonBlockResultStatus,
    onSQL: getSQLBlockResultStatus,
    onVisualization: getVisualizationBlockResultStatus,
    onInput: (block) => getInputBlockExecStatus(block, blocks),
    onDropdownInput: (block) => getDropdownInputBlockExecStatus(block, blocks),
    onDateInput: (block) => getDateInputBlockExecStatus(block),
    onRichText: getRichTextBlockExecStatus,
    onFileUpload: () => 'idle',
    onDashboardHeader: () => 'idle',
    onWriteback: getWritebackBlockResultStatus,
    onPivotTable: getPivotTableBlockResultStatus,
  })

export const getPrettyTitle = (type: BlockType): string => {
  switch (type) {
    case BlockType.RichText:
      return 'Text'
    case BlockType.SQL:
      return 'SQL'
    case BlockType.Python:
      return 'Python'
    case BlockType.Visualization:
      return 'Visualization'
    case BlockType.Input:
      return 'Input'
    case BlockType.DropdownInput:
      return 'Dropdown'
    case BlockType.DateInput:
      return 'Date'
    case BlockType.FileUpload:
      return 'Files'
    case BlockType.DashboardHeader:
      return 'Dashboard Header'
    case BlockType.Writeback:
      return 'Writeback'
    case BlockType.PivotTable:
      return 'Pivot Table'
  }
}

export type ValueTypes =
  | Object
  | number
  | null
  | Array<any>
  | string
  | Uint8Array
  | Y.AbstractType<any>

export function getAttributeOr<
  B extends { [key: string]: ValueTypes },
  K extends keyof B & string
>(block: Y.XmlElement<B>, key: K, defaultValue: B[K]): B[K] {
  const value = block.getAttribute(key)
  if (value === undefined) {
    block.setAttribute(key, defaultValue)
    return defaultValue
  }

  return value
}

function getAttributeOrThrow<B extends Block, K extends keyof B & string>(
  block: Y.XmlElement<B>,
  key: K
): B[K] {
  const value = block.getAttribute(key)
  if (value === undefined) {
    throw new Error(
      `Block(${block.getAttribute('id')} is missing required attribute ${key}`
    )
  }

  return value
}

export function getBaseAttributes<T extends BlockType>(
  block: YBlock
): BaseBlock<T> {
  const id = getAttributeOrThrow(block, 'id')
  const index = getAttributeOr(block, 'index', null)
  const title = getAttributeOr(block, 'title', '')
  const type = getAttributeOrThrow(block, 'type') as T

  return { id, index, title, type }
}

export function duplicateBaseAttributes<T extends BlockType>(
  newId: string,
  prevAttributes: BaseBlock<T>
): BaseBlock<T> {
  return {
    id: newId,
    index: prevAttributes.index,
    title: prevAttributes.title,
    type: prevAttributes.type,
  }
}

export function isExecutableBlock(block: YBlock): boolean {
  return switchBlockType(block, {
    onPython: () => true,
    onSQL: () => true,
    onVisualization: () => true,
    onInput: () => true,
    onDropdownInput: () => true,
    onWriteback: () => true,
    onDateInput: () => true,
    onRichText: () => false,
    onFileUpload: () => false,
    onDashboardHeader: () => false,
    onPivotTable: () => true,
  })
}

export function duplicateYText(text: Y.Text): Y.Text {
  const newText = new Y.Text()
  newText.insert(0, text.toString())
  const attrs = text.getAttributes()
  for (const [key, value] of Object.entries(attrs)) {
    newText.setAttribute(key, clone(value))
  }

  return newText
}

export function duplicateBlock(
  newBlockId: string,
  block: YBlock,
  blocks: Y.Map<YBlock>,
  duplicatingDocument: boolean,
  options?: {
    datasourceMap?: Map<string, string>
    componentId?: string
    noState?: boolean
  }
): YBlock {
  return switchBlockType<YBlock>(block, {
    onSQL: (block) => duplicateSQLBlock(newBlockId, block, blocks, options),
    onPython: (block) => duplicatePythonBlock(newBlockId, block, options),
    onVisualization: (block) => duplicateVisualizationBlock(newBlockId, block),
    onInput: (block) => duplicateInputBlock(newBlockId, block, blocks),
    onDropdownInput: (block) =>
      duplicateDropdownInputBlock(newBlockId, block, blocks),
    onDateInput: (block) => duplicateDateInputBlock(newBlockId, block, blocks),
    onRichText: (block) => duplicateRichTextBlock(newBlockId, block),
    onFileUpload: (block) => duplicateFileUploadBlock(newBlockId, block),
    onDashboardHeader: (block) =>
      duplicateDashboardHeaderBlock(newBlockId, block),
    onWriteback: (block) => duplicateWritebackBlock(newBlockId, block, options),
    onPivotTable: (block) =>
      duplicatePivotTableBlock(newBlockId, block, blocks, !duplicatingDocument),
  })
}

function getExecutedAt(block: YBlock, blocks: Y.Map<YBlock>): Date | null {
  return switchBlockType(block, {
    onPython: (block) => getPythonBlockExecutedAt(block),
    onSQL: (block) => getSQLBlockExecutedAt(block, blocks),
    onVisualization: (block) => getVisualizationBlockExecutedAt(block),
    onInput: (block) => getInputBlockExecutedAt(block, blocks),
    onDropdownInput: (block) => getDropdownInputBlockExecutedAt(block, blocks),
    onWriteback: (block) => getWritebackBlockExecutedAt(block),
    onDateInput: (block) => getDateInputBlockExecutedAt(block, blocks),
    onRichText: () => null,
    onFileUpload: () => null,
    onDashboardHeader: () => null,
    onPivotTable: (block) => getPivotTableBlockExecutedAt(block, blocks),
  })
}

function mustExecute(
  block: YBlock,
  blocks: Y.Map<YBlock>,
  environmentStartedAt: Date | null
): boolean {
  if (!isExecutableBlock(block)) {
    return false
  }

  if (environmentStartedAt === null) {
    return true
  }

  const executedAt = getExecutedAt(block, blocks)
  if (executedAt === null) {
    return true
  }

  return dfns.isAfter(environmentStartedAt, executedAt)
}

export function computeDepencyQueue(
  block: YBlock,
  layout: Y.Array<YBlockGroup>,
  blocks: Y.Map<YBlock>,
  environmentStartedAt: Date | null
): YBlock[] {
  const flatLayout = layout
    .toArray()
    .flatMap((blockGroup) =>
      (blockGroup.getAttribute('tabs')?.toArray() ?? []).map((tab) => {
        const blockId = tab.getAttribute('id')
        if (!blockId) {
          return null
        }

        return blocks.get(blockId) ?? null
      })
    )
    .filter((block): block is YBlock => block !== null)

  const blockIndex = flatLayout.findIndex((b) => b === block)
  if (blockIndex === -1) {
    return []
  }

  const blocksBefore = flatLayout.slice(0, blockIndex)
  const blocksBeforeToRun = blocksBefore.filter((block) =>
    mustExecute(block, blocks, environmentStartedAt)
  )

  return blocksBeforeToRun
}

export function getErrorMessage(block: YBlock): string | null {
  return switchBlockType(block, {
    onPython: getPythonBlockErrorMessage,
    onSQL: getSQLBlockErrorMessage,
    onVisualization: getVisualizationBlockErrorMessage,
    onWriteback: getWritebackBlockErrorMessage,
    onInput: () => null,
    onDropdownInput: () => null,
    onDateInput: () => null,
    onRichText: () => null,
    onFileUpload: () => null,
    onDashboardHeader: () => null,
    onPivotTable: getPivotTableBlockErrorMessage,
  })
}

export * from './dashboard.js'
export * from './richText.js'
export * from './sql.js'
export * from './python.js'
export * from './visualization.js'
export * from './input.js'
export * from './dropdownInput.js'
export * from './dateInput.js'
export * from './fileUpload.js'
export * from './writeback.js'
export * from './pivotTable.js'
