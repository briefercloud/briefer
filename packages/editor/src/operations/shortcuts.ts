import * as Y from 'yjs'
import {
  YBlockGroup,
  getTabsFromBlockGroup,
  getTabsFromBlockGroupId,
} from './blockGroup.js'
import { YBlock } from '../blocks/index.js'

const getVerticalBlockId = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  blockId: string | null,
  pos: 'above' | 'below'
) => {
  if (!blockId) {
    return null
  }

  const currIndex = yLayout.toArray().findIndex((bg) => {
    const tabs = getTabsFromBlockGroup(bg, yBlockDefs)
    return tabs.some((tab) => tab.blockId === blockId)
  })

  if (currIndex === -1) {
    return null
  }

  const blockGroupBelowId = yLayout
    .get(pos === 'below' ? currIndex + 1 : currIndex - 1)
    ?.getAttribute('id')

  if (!blockGroupBelowId) {
    return null
  }

  const blockBelowActiveTabId = getTabsFromBlockGroupId(
    yLayout,
    yBlockDefs,
    blockGroupBelowId
  ).find((tab) => tab.isCurrent)?.blockId

  return {
    blockGroupId: blockGroupBelowId,
    blockId: blockBelowActiveTabId ?? null,
  }
}

const getLateralBlockId = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  blockId: string | null,
  pos: 'left' | 'right'
) => {
  if (!blockId) {
    return null
  }

  const blockGroupId = yLayout
    .toArray()
    .find((bg) => {
      const tabs = getTabsFromBlockGroup(bg, yBlockDefs)
      return tabs.some((tab) => tab.blockId === blockId)
    })
    ?.getAttribute('id')

  if (!blockGroupId) {
    return null
  }

  const currIndex = yLayout.toArray().findIndex((bg) => {
    return bg.getAttribute('id') === blockGroupId
  })

  if (currIndex === -1) {
    return null
  }

  const blockGroup = yLayout.get(currIndex)
  if (!blockGroup) {
    return null
  }

  const tabs = getTabsFromBlockGroup(blockGroup, yBlockDefs)
  const currTabIndex = tabs.findIndex((tab) => tab.blockId === blockId)

  if (currTabIndex === -1) {
    return null
  }

  const tabBlockId = tabs[currTabIndex + (pos === 'left' ? -1 : 1)]?.blockId

  return {
    blockGroupId: blockGroupId,
    blockId: tabBlockId ?? null,
  }
}

export const getRelativeBlockId = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  blockId: string | null,
  pos: 'above' | 'below' | 'left' | 'right'
) => {
  return pos === 'above' || pos === 'below'
    ? getVerticalBlockId(yLayout, yBlockDefs, blockId, pos)
    : getLateralBlockId(yLayout, yBlockDefs, blockId, pos)
}

export const getNextBlockIdAfterDelete = (
  yLayout: Y.Array<YBlockGroup>,
  yBlockDefs: Y.Map<YBlock>,
  blockId: string
) => {
  const blockIndex = yLayout.toArray().findIndex((bg) => {
    const tabs = getTabsFromBlockGroup(bg, yBlockDefs)
    return tabs.some((t) => t.blockId === blockId)
  })

  const blockGroup = yLayout.get(blockIndex)
  const tabs = getTabsFromBlockGroup(blockGroup, yBlockDefs)

  if (tabs.length === 1) {
    return (
      getRelativeBlockId(
        yLayout,
        yBlockDefs,
        blockId,
        blockIndex === 0 ? 'below' : 'above'
      )?.blockId ?? null
    )
  }

  const tabIndex = tabs.findIndex((t) => t.blockId === blockId)
  if (tabIndex === -1) {
    return null
  }

  if (tabIndex === 0) {
    return (
      getRelativeBlockId(yLayout, yBlockDefs, blockId, 'right')?.blockId ?? null
    )
  }

  return (
    getRelativeBlockId(yLayout, yBlockDefs, blockId, 'left')?.blockId ?? null
  )
}
