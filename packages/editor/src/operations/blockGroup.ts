import * as Y from 'yjs'
import { v4 as uuidv4 } from 'uuid'
import { BlockType, YBlock } from '../blocks/index.js'
import { duplicateBlock } from '../blocks/index.js'
import {
  getBlocks,
  getDashboard,
  getLayout,
  isBlockInDashboard,
  removeBlocksFromDashboard,
} from '../index.js'

export type TabRef = {
  blockGroupId: string
  blockId: string
  type: BlockType
  title: string | null
  isCurrent: boolean
  isHiddenInPublished: boolean
}

type BlockRef = {
  id: string
  isHiddenInPublished: boolean
}
export type YBlockRef = Y.XmlElement<BlockRef>

function makeYBlockRef(blockId: string): YBlockRef {
  const blockRef = new Y.XmlElement('block-ref')
  const attrs: BlockRef = {
    id: blockId,
    isHiddenInPublished: false,
  }

  for (const [key, value] of Object.entries(attrs)) {
    blockRef.setAttribute(
      key,
      // @ts-ignore
      value
    )
  }

  return blockRef
}

function cloneYBlockRef(blockRef: YBlockRef): YBlockRef {
  const newBlockRef = new Y.XmlElement('block-ref')
  const id = blockRef.getAttribute('id')
  if (!id) {
    throw new Error('Invalid block ref')
  }

  const attrs: BlockRef = {
    id,
    isHiddenInPublished: blockRef.getAttribute('isHiddenInPublished') ?? false,
  }

  for (const [key, value] of Object.entries(attrs)) {
    newBlockRef.setAttribute(
      key,
      // @ts-ignore
      value
    )
  }

  return newBlockRef
}

export type YBlockGroupAttributes = {
  id: string
  tabs: Y.Array<YBlockRef>
  current: YBlockRef
}

export type YBlockGroup = Y.XmlElement<YBlockGroupAttributes>

export function makeYBlockGroup(
  groupId: string,
  firstBlockId: string,
  restBlockIds: string[]
): YBlockGroup {
  const blockGroup = new Y.XmlElement('block-group')

  const tabs = new Y.Array<YBlockRef>()
  tabs.push([firstBlockId, ...restBlockIds].map(makeYBlockRef))

  const attrs: YBlockGroupAttributes = {
    id: groupId,
    tabs,
    current: makeYBlockRef(firstBlockId),
  }

  for (const [key, value] of Object.entries(attrs)) {
    // @ts-ignore
    blockGroup.setAttribute(key, value)
  }

  return blockGroup
}

export const cloneTabs = (tab: Y.Array<YBlockRef>) => {
  const newTabs: Y.Array<YBlockRef> = new Y.Array()
  tab.forEach((t) => {
    newTabs.push([cloneYBlockRef(t)])
  })
  return newTabs
}

export const cloneBlockGroup = (blockGroup: YBlockGroup) => {
  const newBlockGroup: YBlockGroup = new Y.XmlElement('block-group')
  const id = blockGroup.getAttribute('id')
  const tabs = blockGroup.getAttribute('tabs')
  const current = blockGroup.getAttribute('current')

  if (!id || !tabs || !current) {
    throw new Error('Invalid block group')
  }

  newBlockGroup.setAttribute('id', id)
  newBlockGroup.setAttribute('tabs', cloneTabs(tabs))
  newBlockGroup.setAttribute('current', cloneYBlockRef(current))

  return newBlockGroup
}

export const switchActiveTab = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  tabId: string
) => {
  const blockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (blockGroupIndex === -1) {
    throw new Error('Invalid block group')
  }

  const blockGroup = yLayout.get(blockGroupIndex)

  const newCurrentRef = new Y.XmlElement('block-ref')
  newCurrentRef.setAttribute('id', tabId)
  blockGroup.setAttribute('current', newCurrentRef)
}

function notEmpty<TValue>(value: TValue | null | undefined): value is TValue {
  return value !== null && value !== undefined
}

export const getTabsFromBlockGroup = (
  blockGroup: YBlockGroup,
  yBlocks: Y.Map<YBlock>
): TabRef[] => {
  const blockGroupId = blockGroup.getAttribute('id')
  const tabRefs = blockGroup.getAttribute('tabs')?.toArray()
  if (!tabRefs || !blockGroupId) {
    return []
  }

  const currentBlockId = blockGroup.getAttribute('current')?.getAttribute('id')

  return tabRefs
    .map((tab) => {
      const blockId = tab.getAttribute('id')
      if (!blockId) {
        return null
      }

      const block = yBlocks.get(blockId)
      if (!block) {
        return null
      }
      const type = block.getAttribute('type')
      if (!type) {
        return null
      }

      const isCurrent = blockId === currentBlockId

      return {
        blockGroupId,
        blockId,
        type,
        title: block.getAttribute('title') ?? null,
        isCurrent,
        isHiddenInPublished: tab.getAttribute('isHiddenInPublished') ?? false,
      }
    })
    .filter(notEmpty)
}

export const getTabsFromBlockGroupId = (
  yLayout: Y.Array<YBlockGroup>,
  yBlocks: Y.Map<YBlock>,
  blockGroupId: string
): TabRef[] => {
  const currentBlockGroup = yLayout
    .toArray()
    .find((blockGroup) => blockGroup.getAttribute('id') === blockGroupId)

  if (!currentBlockGroup) {
    return []
  }

  return getTabsFromBlockGroup(currentBlockGroup, yBlocks)
}

export const getBlockGroup = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string
) =>
  yLayout
    .toArray()
    .find((yBlockGroup) => yBlockGroup.getAttribute('id') === blockGroupId) ??
  null

export const ungroupTab = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  blockId: string,
  targetIndex: number
) => {
  const blockGroupIndex = yLayout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  const blockGroup = yLayout.get(blockGroupIndex)
  const tabs = blockGroup.getAttribute('tabs')
  const current = blockGroup.getAttribute('current')

  const tabIndex = tabs
    ?.toArray()
    .findIndex((tab) => tab.getAttribute('id') === blockId)
  const tabRef = tabs?.get(tabIndex ?? 0)

  if (
    tabs === undefined ||
    current === undefined ||
    tabIndex === undefined ||
    !tabRef
  ) {
    throw new Error('Invalid block group')
  }

  // If this is the current tab in the block, we need to find a new current tab
  let deletedWholeGroup = false
  const isCurrentTab = current.getAttribute('id') === blockId
  if (isCurrentTab) {
    const prevTab: YBlockRef | undefined = tabs.get(tabIndex - 1)
    const nextTab: YBlockRef | undefined = tabs.get(tabIndex + 1)
    const newCurrentTabId =
      nextTab?.getAttribute('id') ?? prevTab?.getAttribute('id')

    if (!newCurrentTabId) {
      yLayout.delete(blockGroupIndex)
      deletedWholeGroup = true
    } else {
      const newCurrentRef = new Y.XmlElement('block-ref')
      newCurrentRef.setAttribute('id', newCurrentTabId)
      blockGroup.setAttribute('current', newCurrentRef)
    }
  }

  // Inserting a new block group with the tab
  const newBlockGroup: YBlockGroup = new Y.XmlElement('block-group')
  newBlockGroup.setAttribute('id', uuidv4())

  const newTabs: Y.Array<YBlockRef> = new Y.Array()
  const newTabRef: YBlockRef = new Y.XmlElement('block-ref')
  newTabRef.setAttribute('id', blockId)
  newTabs.push([newTabRef])

  const newCurrentRef: YBlockRef = new Y.XmlElement('block-ref')
  newCurrentRef.setAttribute('id', blockId)

  newBlockGroup.setAttribute('tabs', newTabs)
  newBlockGroup.setAttribute('current', newCurrentRef)

  if (deletedWholeGroup && blockGroupIndex < targetIndex) {
    yLayout.insert(targetIndex - 1, [newBlockGroup])
  } else {
    yLayout.insert(targetIndex, [newBlockGroup])
  }

  // We only want to delete the tab if we didn't delete the whole group
  if (!deletedWholeGroup) {
    tabs.delete(tabIndex)
  }
}

export const getCurrentTabId = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  yBlocks: Y.Map<YBlock>,
  isApp: boolean
) => {
  const blockGroup = yLayout
    .toArray()
    .find((yBlockGroup) => yBlockGroup.getAttribute('id') === blockGroupId)

  if (!blockGroup) {
    throw new Error('Invalid block group')
  }

  const currentTabId = blockGroup.getAttribute('current')?.getAttribute('id')
  if (!currentTabId) {
    throw new Error('Invalid block group')
  }

  const tabs = getTabsFromBlockGroup(blockGroup, yBlocks).filter((t) =>
    isApp ? !t.isHiddenInPublished : true
  )

  const currentTab = tabs.find((tab) => tab.blockId === currentTabId) ?? tabs[0]
  return currentTab?.blockId
}

export const canReorderTab = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  sourceTabId: string,
  targetTabId: string,
  direction: 'left' | 'right'
) => {
  // false if tabs are the same
  if (sourceTabId === targetTabId) {
    return false
  }

  const blockGroup = yLayout.toArray().find((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (!blockGroup) {
    return false
  }

  const tabs = blockGroup.getAttribute('tabs')
  if (!tabs) {
    return false
  }

  const sourceTabIndex = tabs
    .toArray()
    .findIndex((tab) => tab.getAttribute('id') === sourceTabId)
  const targetTabIndex = tabs
    .toArray()
    .findIndex((tab) => tab.getAttribute('id') === targetTabId)
  if (sourceTabIndex === -1 || targetTabIndex === -1) {
    return false
  }

  if (direction === 'left' && sourceTabIndex === targetTabIndex - 1) {
    return false
  }

  if (direction === 'right' && sourceTabIndex === targetTabIndex + 1) {
    return false
  }

  return true
}

export const reorderTab = (
  yLayout: Y.Array<YBlockGroup>,
  blockGroupId: string,
  sourceTabId: string,
  targetTabId: string,
  direction: 'left' | 'right'
) => {
  // Does nothing if tabs are the same
  if (sourceTabId === targetTabId) {
    return
  }

  const blockGroup = yLayout.toArray().find((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (!blockGroup) {
    return
  }

  const tabs = blockGroup.getAttribute('tabs')
  if (!tabs) {
    return
  }

  const sourceTabIndex = tabs
    .toArray()
    .findIndex((tab) => tab.getAttribute('id') === sourceTabId)
  const targetTabIndex = tabs
    .toArray()
    .findIndex((tab) => tab.getAttribute('id') === targetTabId)
  if (sourceTabIndex === -1 || targetTabIndex === -1) {
    return
  }

  const sourceTab = tabs.get(sourceTabIndex).clone()
  tabs.delete(sourceTabIndex)
  const actualTargetTabIndex =
    sourceTabIndex < targetTabIndex ? targetTabIndex - 1 : targetTabIndex

  if (direction === 'left') {
    tabs.insert(actualTargetTabIndex, [sourceTab])
  } else {
    tabs.insert(actualTargetTabIndex + 1, [sourceTab])
  }
}

export type RemoveBlockResult =
  | {
      _tag: 'success'
    }
  | RemoveBlockDashboardConflictResult

export type RemoveBlockDashboardConflictResult = {
  _tag: 'dashboard-conflict'
  blockGroupId: string
  tabId: string
}

export const removeBlock = (
  yDoc: Y.Doc,
  blockGroupId: string,
  tabId: string,
  removeFromDashboard: boolean
): RemoveBlockResult => {
  const layout = getLayout(yDoc)
  const blockGroupIndex = layout.toArray().findIndex((yBlockGroup) => {
    return yBlockGroup.getAttribute('id') === blockGroupId
  })

  if (blockGroupIndex === -1) {
    return { _tag: 'success' }
  }

  const blockGroup = layout.get(blockGroupIndex)
  const tabs = blockGroup.getAttribute('tabs')
  const current = blockGroup.getAttribute('current')

  const tabIndex = tabs
    ?.toArray()
    .findIndex((tab) => tab.getAttribute('id') === tabId)
  const tabRef = tabs?.get(tabIndex ?? 0)

  if (
    tabs === undefined ||
    current === undefined ||
    tabIndex === undefined ||
    !tabRef
  ) {
    return { _tag: 'success' }
  }

  const dashboard = getDashboard(yDoc)
  const blocks = getBlocks(yDoc)

  if (!removeFromDashboard && isBlockInDashboard(dashboard, tabId)) {
    return {
      _tag: 'dashboard-conflict',
      blockGroupId,
      tabId,
    }
  }

  yDoc.transact(() => {
    // If this is the current tab in the block, we need to find a new current tab
    const isCurrentTab = current.getAttribute('id') === tabId
    if (isCurrentTab) {
      const prevTab: YBlockRef | undefined = tabs.get(tabIndex - 1)
      const nextTab: YBlockRef | undefined = tabs.get(tabIndex + 1)
      const newCurrentTabId =
        nextTab?.getAttribute('id') ?? prevTab?.getAttribute('id')

      if (!newCurrentTabId) {
        layout.delete(blockGroupIndex)
      } else {
        const newCurrentRef = new Y.XmlElement('block-ref')
        newCurrentRef.setAttribute('id', newCurrentTabId)
        blockGroup.setAttribute('current', newCurrentRef)
      }
    }

    tabs.delete(tabIndex)
    blocks.delete(tabId)
    removeBlocksFromDashboard(dashboard, [tabId])
  })

  return { _tag: 'success' }
}

export const duplicateTab = (
  yLayout: Y.Array<YBlockGroup>,
  yBlocks: Y.Map<YBlock>,
  blockGroupId: string,
  tabId: string,
  newVariableName: boolean
) => {
  const blockGroup = yLayout
    .toArray()
    .find((yBlockGroup) => yBlockGroup.getAttribute('id') === blockGroupId)

  if (!blockGroup) {
    return
  }

  const tabs = blockGroup.getAttribute('tabs')
  const current = blockGroup.getAttribute('current')
  const tabIndex = tabs
    ?.toArray()
    .findIndex((tab) => tab.getAttribute('id') === tabId)
  const oldTabRef = tabs?.get(tabIndex ?? 0)
  const oldBlockId = oldTabRef?.getAttribute('id')
  const oldBlock = oldBlockId ? yBlocks.get(oldBlockId) : null

  if (
    tabs === undefined ||
    current === undefined ||
    tabIndex === undefined ||
    !oldTabRef ||
    !oldBlock
  ) {
    return
  }

  const newId = uuidv4()
  const newBlock = duplicateBlock(newId, oldBlock, yBlocks, false, {
    newVariableName,
  })
  yBlocks.set(newId, newBlock)

  const newTabRef = oldTabRef.clone()
  newTabRef.setAttribute('id', newId)
  tabs.insert(tabIndex + 1, [newTabRef])

  current.setAttribute('id', newId)
}

export const toggleIsBlockHiddenInPublished = (
  blockGroup: YBlockGroup,
  blockId: string
) => {
  const tabs = blockGroup.getAttribute('tabs')
  if (!tabs) {
    return
  }

  const tab = tabs.toArray().find((tab) => tab.getAttribute('id') === blockId)
  if (!tab) {
    return
  }

  const operation = () => {
    const isHidden = tab.getAttribute('isHiddenInPublished') ?? false
    tab.setAttribute('isHiddenInPublished', !isHidden)
  }

  if (blockGroup.doc) {
    blockGroup.doc.transact(operation)
  } else {
    operation()
  }
}
