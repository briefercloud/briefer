import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import {
  cloneBlockGroup,
  YBlockRef,
  YBlockGroup,
  TabRef,
  getTabsFromBlockGroup,
} from './blockGroup.js'
import {
  BlockType,
  YBlock,
  duplicateBlock,
  getAttributeOr,
  makeDashboardHeaderBlock,
  makeDropdownInputBlock,
  makeFileUploadBlock,
  makeInputBlock,
  makePythonBlock,
  makeVisualizationBlock,
} from '../blocks/index.js'
import { makeRichTextBlock } from '../blocks/richText.js'
import { makeSQLBlock } from '../blocks/sql.js'
import { makeWritebackBlock } from '../blocks/writeback.js'
import { makeDateInputBlock } from '../blocks/dateInput.js'
import {
  YDashboardItem,
  getBlocks,
  getDashboard,
  getLayout,
  makeVisualizationV2Block,
  removeBlocksFromDashboard,
  switchBlockType,
} from '../index.js'
import { makePivotTableBlock } from '../blocks/pivotTable.js'

export type AddBlockGroupBlock =
  | {
      type:
        | BlockType.RichText
        | BlockType.Input
        | BlockType.DropdownInput
        | BlockType.DateInput
        | BlockType.FileUpload
        | BlockType.Writeback
    }
  | {
      type: BlockType.Python
      source?: string
    }
  | {
      type: BlockType.SQL
      dataSourceId: string | null
      isFileDataSource: boolean
      source?: string
    }
  | {
      type:
        | BlockType.Visualization
        | BlockType.VisualizationV2
        | BlockType.PivotTable
      dataframeName: string | null
    }
  | { type: BlockType.DashboardHeader; content: string }

const createBlock = (block: AddBlockGroupBlock, yBlockDefs: Y.Map<YBlock>) => {
  const blockId = uuidv4()
  let yBlock: YBlock

  switch (block.type) {
    case BlockType.RichText:
      yBlock = makeRichTextBlock(blockId)
      break
    case BlockType.SQL:
      yBlock = makeSQLBlock(blockId, yBlockDefs, {
        dataSourceId: block.dataSourceId,
        isFileDataSource: block.isFileDataSource,
        source: block.source,
      })
      break
    case BlockType.Python:
      yBlock = makePythonBlock(blockId, {
        source: block.source,
      })
      break
    case BlockType.Visualization:
      yBlock = makeVisualizationBlock(blockId, {
        dataframeName: block.dataframeName,
      })
      break
    case BlockType.VisualizationV2:
      yBlock = makeVisualizationV2Block(blockId, {
        dataframeName: block.dataframeName,
      })
      break
    case BlockType.Input:
      yBlock = makeInputBlock(blockId, yBlockDefs)
      break
    case BlockType.DropdownInput:
      yBlock = makeDropdownInputBlock(blockId, yBlockDefs)
      break
    case BlockType.DateInput:
      yBlock = makeDateInputBlock(blockId, yBlockDefs)
      break
    case BlockType.FileUpload:
      yBlock = makeFileUploadBlock(blockId)
      break
    case BlockType.DashboardHeader:
      yBlock = makeDashboardHeaderBlock(blockId, {
        content: block.content,
      })
      break
    case BlockType.Writeback:
      yBlock = makeWritebackBlock(blockId)
      break
    case BlockType.PivotTable:
      yBlock = makePivotTableBlock(blockId, yBlockDefs, block.dataframeName)
      break
  }

  yBlockDefs.set(blockId, yBlock)
  return blockId
}

export function addBlockGroupAfterBlock(
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  addBlock: AddBlockGroupBlock,
  blockId: string
) {
  let index = yLayout.toArray().findIndex((yBlockGroup) =>
    yBlockGroup
      .getAttribute('tabs')
      ?.toArray()
      .some((tab) => tab.getAttribute('id') === blockId)
  )

  if (index === -1) {
    index = 0
  }

  return addBlockGroup(yLayout, yBlockDefs, addBlock, index + 1)
}

export function appendBlock(
  id: string,
  block: YBlock,
  blocks: Y.Map<YBlock>,
  yLayout: Y.Array<YBlockGroup>
) {
  blocks.set(id, block)

  const blockGroupId = uuidv4()
  const yBlockGroup: YBlockGroup = new Y.XmlElement('block-group')
  yLayout.push([yBlockGroup])
  yBlockGroup.setAttribute('id', blockGroupId)

  const currentRef = new Y.XmlElement('block-ref')
  currentRef.setAttribute('id', id)
  yBlockGroup.setAttribute('current', currentRef)

  const tabs: Y.Array<YBlockRef> = new Y.Array()
  tabs.push([currentRef.clone()])

  yBlockGroup.setAttribute('tabs', tabs)
}

export const addBlockGroup = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  block: AddBlockGroupBlock,
  index: number
) => {
  const blockId = createBlock(block, yBlockDefs)

  const blockGroupId = uuidv4()
  const yBlockGroup: YBlockGroup = new Y.XmlElement('block-group')
  yLayout.insert(index, [yBlockGroup])
  yBlockGroup.setAttribute('id', blockGroupId)

  const currentRef = new Y.XmlElement('block-ref')
  currentRef.setAttribute('id', blockId)
  yBlockGroup.setAttribute('current', currentRef)

  const tabs: Y.Array<YBlockRef> = new Y.Array()
  tabs.push([currentRef.clone()])

  yBlockGroup.setAttribute('tabs', tabs)

  return blockId
}

export const updateOrder = (
  yLayout: Y.Array<YBlockGroup>,
  sourceGroupId: string,
  targetIndex: number
) => {
  const sourceIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === sourceGroupId
  })

  const oldSourceBlockGroup = yLayout.get(sourceIndex)
  if (!oldSourceBlockGroup) {
    throw new Error('Invalid source block group')
  }

  const newBlockGroup = cloneBlockGroup(oldSourceBlockGroup)

  yLayout.insert(targetIndex, [newBlockGroup])

  if (sourceIndex < targetIndex) {
    yLayout.delete(sourceIndex)
  } else {
    yLayout.delete(sourceIndex + 1)
  }
}

export const groupBlockGroups = (
  yLayout: Y.Array<YBlockGroup>,
  droppedGroupId: string,
  targetGroupId: string
) => {
  const droppedIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === droppedGroupId
  })
  const targetIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === targetGroupId
  })

  if (droppedIndex === -1 || targetIndex === -1) {
    throw new Error('Invalid block group')
  }

  const droppedTabs =
    yLayout
      .get(droppedIndex)
      .getAttribute('tabs')
      ?.map((t) => t.clone()) ?? []
  const targetBlock = yLayout.get(targetIndex)

  const activeDroppedTab = yLayout
    .get(droppedIndex)
    .getAttribute('current')
    ?.clone()

  if (droppedIndex < targetIndex) {
    targetBlock.getAttribute('tabs')?.unshift(droppedTabs)
  } else {
    targetBlock.getAttribute('tabs')?.push(droppedTabs)
  }

  yLayout.delete(droppedIndex)

  if (activeDroppedTab) {
    targetBlock.setAttribute('current', activeDroppedTab)
  }
}

export const groupBlocks = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  blockId: string,
  targetGroupId: string
) => {
  const sourceBlockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })
  const sourceBlockGroup = yLayout.get(sourceBlockGroupIndex)

  const tabs = sourceBlockGroup.getAttribute('tabs')
  const tabIndex = tabs?.toArray().findIndex((tab) => {
    return tab.getAttribute('id') === blockId
  })
  const sourceCurrentBlockRef = sourceBlockGroup.getAttribute('current')

  if (!sourceCurrentBlockRef || tabIndex === undefined || tabIndex === -1) {
    throw new Error('Invalid block')
  }

  // if block being moved is the current block we need to select a new current
  const isCurrentBlock = sourceCurrentBlockRef.getAttribute('id') === blockId
  if (isCurrentBlock) {
    const prevTab = sourceBlockGroup.getAttribute('tabs')?.get(tabIndex - 1)
    const nextTab = sourceBlockGroup.getAttribute('tabs')?.get(tabIndex + 1)

    const newCurrentTabId =
      nextTab?.getAttribute('id') ?? prevTab?.getAttribute('id')
    const newCurrentRef = new Y.XmlElement('block-ref')
    newCurrentRef.setAttribute('id', newCurrentTabId ?? '')
    sourceBlockGroup.setAttribute('current', newCurrentRef)
  }

  // remove block from tabs in source block groupBlocks
  tabs?.delete(tabIndex)

  // add tab to the target group
  const targetBlockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === targetGroupId
  })
  const targetBlockGroup = yLayout.get(targetBlockGroupIndex)
  const newTabRef = new Y.XmlElement('block-ref')
  newTabRef.setAttribute('id', blockId)

  const targetBlockGroupTabs = targetBlockGroup.getAttribute('tabs')
  if (sourceBlockGroupIndex < targetBlockGroupIndex) {
    targetBlockGroupTabs?.unshift([newTabRef])
  } else {
    targetBlockGroupTabs?.push([newTabRef])
  }

  if (tabs?.length === 0) {
    yLayout.delete(sourceBlockGroupIndex)
  }

  // focus on the newly added block
  targetBlockGroup.setAttribute('current', newTabRef.clone())
}

export const checkCanDropBlockGroup = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  desiredIndex: number
) => {
  const blockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (blockGroupIndex === -1) {
    return false
  }

  return (
    blockGroupIndex !== desiredIndex && blockGroupIndex + 1 !== desiredIndex
  )
}

export const checkCanDropBlock = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  targetIndex: number
) => {
  const blockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  const blockGroup = yLayout.get(blockGroupIndex)
  const blockGroupTabs = blockGroup.getAttribute('tabs')
  if (!blockGroupTabs) {
    return false
  }

  if (blockGroupTabs.length > 1) {
    return true
  }

  return blockGroupIndex !== targetIndex && blockGroupIndex !== targetIndex - 1
}

export type RemoveBlockGroupDashboardConflictResult = {
  _tag: 'dashboard-conflict'
  blockGroupId: string
  tabRefs: TabRef[]
}

export type RemoveBlockGroupResult =
  | {
      _tag: 'success'
    }
  | RemoveBlockGroupDashboardConflictResult

function extractDashboardRefs(
  tabRefs: TabRef[],
  dashboard: Y.Map<YDashboardItem>
): TabRef[] {
  const dashConflicts: TabRef[] = []
  const tabsByBlockId = new Map<string, TabRef>()
  for (const tab of tabRefs) {
    tabsByBlockId.set(tab.blockId, tab)
  }
  for (const dashItem of dashboard.values()) {
    const blockId = dashItem.getAttribute('blockId')
    if (blockId) {
      const tabRef = tabsByBlockId.get(blockId)
      if (tabRef) {
        dashConflicts.push(tabRef)
      }
    }
  }

  return dashConflicts
}

export const removeBlockGroup = (
  yDoc: Y.Doc,
  blockGroupId: string,
  removeFromDashboard: boolean
): RemoveBlockGroupResult => {
  const layout = getLayout(yDoc)
  const blockGroupIndex = layout
    .toArray()
    .findIndex((yBlockGroup) => yBlockGroup.getAttribute('id') === blockGroupId)

  if (blockGroupIndex === -1) {
    return { _tag: 'success' }
  }

  const blocks = getBlocks(yDoc)
  const blockGroup = layout.get(blockGroupIndex)

  const tabs = getTabsFromBlockGroup(blockGroup, blocks)
  const dashboard = getDashboard(yDoc)
  const conflicts = extractDashboardRefs(tabs, dashboard)
  if (conflicts.length > 0 && !removeFromDashboard) {
    return {
      _tag: 'dashboard-conflict',
      blockGroupId,
      tabRefs: conflicts,
    }
  }

  const blockIds = tabs.map((tab) => tab.blockId)

  yDoc.transact(() => {
    layout.delete(blockGroupIndex)
    const blocks = getBlocks(yDoc)
    blockIds.forEach((blockId) => {
      blocks.delete(blockId)
    })
    removeBlocksFromDashboard(dashboard, blockIds)
  })

  return { _tag: 'success' }
}

// A new function just to make the name very clear
export const addDashboardOnlyBlock = (
  yBlockDefs: Y.Map<YBlock>,
  block: AddBlockGroupBlock
) => {
  return createBlock(block, yBlockDefs)
}

export const removeDashboardBlock = (
  yBlockDefs: Y.Map<YBlock>,
  blockId: string
) => {
  const block = yBlockDefs.get(blockId)
  const blockType = block?.getAttribute('type')
  if (!block || !blockType) {
    return
  }

  switchBlockType(block, {
    onRichText: () => {},
    onInput: () => {},
    onDropdownInput: () => {},
    onDateInput: () => {},
    onFileUpload: () => {},
    onPython: () => {},
    onSQL: () => {},
    onVisualization: () => {},
    onVisualizationV2: () => {},
    onWriteback: () => {},
    onDashboardHeader: () => {
      yBlockDefs.delete(blockId)
    },
    onPivotTable: () => {},
  })
}

export const addGroupedBlock = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  blockGroupId: string,
  blockId: string,
  block: AddBlockGroupBlock,
  position: 'before' | 'after'
): string | null => {
  const blockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (blockGroupIndex === -1) {
    return null
  }

  const blockGroup = yLayout.get(blockGroupIndex)

  let result: string | null = null

  const run = () => {
    const newBlockId = createBlock(block, yBlockDefs)
    const blockPos = blockGroup
      .getAttribute('tabs')
      ?.toArray()
      .findIndex((tab) => {
        return tab.getAttribute('id') === blockId
      })

    if (blockPos === -1 || blockPos === undefined) {
      result = null
      return
    }

    const ref = new Y.XmlElement('block-ref')
    ref.setAttribute('id', newBlockId)

    if (position === 'before') {
      blockGroup.getAttribute('tabs')?.insert(blockPos, [ref])
    } else {
      blockGroup.getAttribute('tabs')?.insert(blockPos + 1, [ref])
    }

    blockGroup.setAttribute('current', ref.clone())
    result = newBlockId
  }

  if (yLayout.doc) {
    yLayout.doc.transact(run)
  } else {
    run()
  }

  return result
}

export const duplicateBlockGroup = (
  yLayout: Y.Array<YBlockGroup>,
  yBlocks: Y.Map<YBlock>,
  blockGroupId: string,
  newVariableName: boolean
) => {
  const blockGroupIndex = yLayout
    .toArray()
    .findIndex((yBlockGroup) => yBlockGroup.getAttribute('id') === blockGroupId)

  if (blockGroupIndex === -1) {
    return
  }

  const blockGroup = yLayout.get(blockGroupIndex)
  const tabs = getAttributeOr(blockGroup, 'tabs', new Y.Array())
  const oldCurrent = blockGroup.getAttribute('current')
  const oldCurrentId = oldCurrent?.getAttribute('id')
  if (!oldCurrent || !oldCurrentId) {
    return
  }

  const newBlockGroup = blockGroup.clone()
  newBlockGroup.setAttribute('id', uuidv4())
  const newCurrent = oldCurrent.clone()
  newBlockGroup.setAttribute('current', newCurrent)

  const newTabs = new Y.Array<YBlock>()
  tabs.forEach((tab) => {
    const oldBlockId = tab.getAttribute('id')
    const oldBlock = oldBlockId ? yBlocks.get(oldBlockId) : null

    if (!oldBlockId || !oldBlock) {
      return
    }

    const newBlockId = uuidv4()
    if (oldBlockId === oldCurrentId) {
      newCurrent.setAttribute('id', newBlockId)
    }

    const newBlock = duplicateBlock(newBlockId, oldBlock, yBlocks, false, {
      newVariableName,
    })
    yBlocks.set(newBlockId, newBlock)

    const newTab = tab.clone()
    newTab.setAttribute('id', newBlockId)
    newTabs.push([newTab])
  })

  newBlockGroup.setAttribute('tabs', newTabs)
  newBlockGroup.setAttribute('current', newCurrent)

  yLayout.insert(blockGroupIndex + 1, [newBlockGroup])
}
