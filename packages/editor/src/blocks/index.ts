import * as dfns from 'date-fns'
import * as Y from 'yjs'
import { RichTextBlock, duplicateRichTextBlock } from './richText.js'
import {
  SQLBlock,
  duplicateSQLBlock,
  getSQLBlockErrorMessage,
  getSQLBlockExecutedAt,
  getSQLBlockResultStatus,
} from './sql.js'
import {
  PythonBlock,
  duplicatePythonBlock,
  getPythonBlockErrorMessage,
  getPythonBlockExecutedAt,
  getPythonBlockResultStatus,
} from './python.js'
import {
  VisualizationBlock,
  duplicateVisualizationBlock,
  getVisualizationBlockErrorMessage,
  getVisualizationBlockExecutedAt,
  getVisualizationBlockResultStatus,
} from './visualization.js'
import {
  InputBlock,
  duplicateInputBlock,
  getInputBlockExecutedAt,
} from './input.js'
import {
  ExecutionStatus,
  YBlockGroup,
  getInputBlockResultStatus,
  getTabsFromBlockGroup,
  switchBlockType,
} from '../index.js'
import { FileUploadBlock, duplicateFileUploadBlock } from './fileUpload.js'
import {
  DropdownInputBlock,
  duplicateDropdownInputBlock,
  getDropdownInputBlockExecutedAt,
  getDropdownInputBlockResultStatus,
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
  getWritebackBlockExecutedAt,
  getWritebackBlockResultStatus,
} from './writeback.js'
import {
  DateInputBlock,
  duplicateDateInputBlock,
  getDateInputBlockExecutedAt,
  getDateInputBlockResultStatus,
} from './dateInput.js'
import {
  PivotTableBlock,
  duplicatePivotTableBlock,
  getPivotTableBlockErrorMessage,
  getPivotTableBlockExecutedAt,
  getPivotTableBlockResultStatus,
} from './pivotTable.js'
import {
  duplicateVisualizationV2Block,
  getVisualizationV2BlockErrorMessage,
  getVisualizationV2BlockExecutedAt,
  getVisualizationV2BlockResultStatus,
  VisualizationV2Block,
} from './visualization-v2.js'

export enum BlockType {
  RichText = 'RICH_TEXT',
  SQL = 'SQL',
  Python = 'PYTHON',
  Visualization = 'VISUALIZATION',
  VisualizationV2 = 'VISUALIZATION_V2',
  Input = 'INPUT',
  DropdownInput = 'DROPDOWN_INPUT',
  DateInput = 'DATE_INPUT',
  FileUpload = 'FILE_UPLOAD',
  DashboardHeader = 'DASHBOARD_HEADER',
  Writeback = 'WRITEBACK',
  PivotTable = 'PIVOT_TABLE',
}

export type ResultStatus = 'idle' | 'error' | 'success'

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
  | VisualizationV2Block

export type YBlock = Y.XmlElement<Block>

export const setTitle = (block: YBlock, title: string) => {
  block.setAttribute('title', title)
}

export const execStatusIsDisabled = (status: ExecutionStatus): boolean => {
  switch (status) {
    case 'running':
    case 'aborting':
    case 'enqueued':
      return true
    case 'completed':
    case 'unknown':
    case 'idle':
      return false
  }
}

export const getResultStatus = (
  block: YBlock,
  blocks: Y.Map<YBlock>
): ResultStatus =>
  switchBlockType(block, {
    onPython: getPythonBlockResultStatus,
    onSQL: getSQLBlockResultStatus,
    onVisualization: getVisualizationBlockResultStatus,
    onVisualizationV2: getVisualizationV2BlockResultStatus,
    onInput: (block) => getInputBlockResultStatus(block, blocks),
    onDropdownInput: (block) =>
      getDropdownInputBlockResultStatus(block, blocks),
    onDateInput: (block) => getDateInputBlockResultStatus(block, blocks),
    onRichText: () => 'idle',
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
    case BlockType.VisualizationV2:
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
    onVisualizationV2: () => true,
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

export function isInputBlock(block: YBlock): boolean {
  return switchBlockType(block, {
    onPython: () => false,
    onSQL: () => false,
    onVisualization: () => false,
    onVisualizationV2: () => false,
    onInput: () => true,
    onDropdownInput: () => true,
    onWriteback: () => false,
    onDateInput: () => true,
    onRichText: () => false,
    onFileUpload: () => false,
    onDashboardHeader: () => false,
    onPivotTable: () => false,
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
    newVariableName?: boolean
  }
): YBlock {
  return switchBlockType<YBlock>(block, {
    onSQL: (block) => duplicateSQLBlock(newBlockId, block, blocks, options),
    onPython: (block) => duplicatePythonBlock(newBlockId, block, options),
    onVisualization: (block) => duplicateVisualizationBlock(newBlockId, block),
    onVisualizationV2: (block) =>
      duplicateVisualizationV2Block(newBlockId, block),
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
    onVisualizationV2: (block) => getVisualizationV2BlockExecutedAt(block),
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
  environmentStartedAt: string | null,
  skipDependencyCheck: boolean
): boolean {
  if (!isExecutableBlock(block)) {
    return false
  }

  // We should always run input blocks if they have not been run yet
  // even if skipDependencyCheck is true
  if (skipDependencyCheck) {
    const lastExecutedAt = getExecutedAt(block, blocks)
    const lastExecutedAtIsAfterEnvironmentStartedAt =
      lastExecutedAt === null ||
      environmentStartedAt === null ||
      dfns.isAfter(environmentStartedAt, lastExecutedAt)

    return isInputBlock(block) && lastExecutedAtIsAfterEnvironmentStartedAt
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
  skipDependencyCheck: boolean,
  environmentStartedAt: string | null
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
    mustExecute(block, blocks, environmentStartedAt, skipDependencyCheck)
  )

  return blocksBeforeToRun
}

export function getErrorMessage(block: YBlock): string | null {
  return switchBlockType(block, {
    onPython: getPythonBlockErrorMessage,
    onSQL: getSQLBlockErrorMessage,
    onVisualization: getVisualizationBlockErrorMessage,
    onVisualizationV2: getVisualizationV2BlockErrorMessage,
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

export const isRunnableBlock = <B extends YBlock>(block: B): boolean => {
  return switchBlockType<boolean>(block, {
    onPython: () => true,
    onSQL: () => true,
    onVisualization: () => true,
    onVisualizationV2: () => true,
    onWriteback: () => true,
    onInput: () => true,
    onDropdownInput: () => true,
    onDateInput: () => true,
    onRichText: () => false,
    onFileUpload: () => false,
    onDashboardHeader: () => false,
    onPivotTable: () => true,
  })
}

export function getBlockFlatPosition(
  blockId: string,
  layout: Y.Array<YBlockGroup>,
  blocks: Y.Map<YBlock>
): number {
  const flatLayout = layout.toArray().flatMap((blockGroup) => {
    const tab = getTabsFromBlockGroup(blockGroup, blocks)
    return tab.map((b) => b.blockId)
  })

  return flatLayout.findIndex((b) => b === blockId)
}

export * from './dashboard.js'
export * from './richText.js'
export * from './sql.js'
export * from './python.js'
export * from './visualization.js'
export * from './visualization-v2.js'
export * from './input.js'
export * from './dropdownInput.js'
export * from './dateInput.js'
export * from './fileUpload.js'
export * from './writeback.js'
export * from './pivotTable.js'
