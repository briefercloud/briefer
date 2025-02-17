import * as Y from 'yjs'
import { addBlockGroup, addGroupedBlock, groupBlockGroups } from './document.js'
import {
  YBlockGroup,
  getTabsFromBlockGroupId,
  switchActiveTab,
  ungroupTab,
  getCurrentTabId,
  canReorderTab,
  reorderTab,
  removeBlock,
  duplicateTab,
} from './blockGroup.js'
import { BlockType, SQLBlock, YBlock } from '../blocks/index.js'

let yDoc: Y.Doc
let yBlocks: Y.Map<YBlock>
let yLayout: Y.Array<YBlockGroup>
beforeEach(() => {
  yDoc = new Y.Doc()
  yBlocks = yDoc.getMap('blocks')
  yLayout = yDoc.getArray('layout')
})

describe('switchActiveTab', () => {
  test('switches the active tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    switchActiveTab(yLayout, blockGroup1Id, tab1Id)
    expect(getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!).toEqual(
      tab1Id
    )

    switchActiveTab(yLayout, blockGroup1Id, tab2Id)
    expect(getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!).toEqual(
      tab2Id
    )

    switchActiveTab(yLayout, blockGroup1Id, tab3Id)
    expect(getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!).toEqual(
      tab3Id
    )
  })
})

describe('getTabsFromBlockGroupId', () => {
  test('returns the tabs for a block group', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab2Id)

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })
})

describe('ungroupTab', () => {
  test('moves a tab to the first dropzone and selects it', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    ungroupTab(yLayout, blockGroup1Id, tab2Id, 0)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      expect.any(String),
      blockGroup1Id,
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('moves a tab to the last dropzone and selects it', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    ungroupTab(yLayout, blockGroup1Id, tab2Id, 1)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      expect.any(String),
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('moves a lonely tab to the last dropzone', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(2)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!

    ungroupTab(yLayout, blockGroup1Id, tab1Id, 2)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup2Id,
      expect.any(String),
    ])
  })

  test('moving the current tab selects the tab next to it', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 (selected) - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab2Id)

    ungroupTab(yLayout, blockGroup1Id, tab2Id, 0)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      expect.any(String),
      blockGroup1Id,
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('when no next tab, moving the current tab selects previous tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3 (selected)
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab3Id)

    ungroupTab(yLayout, blockGroup1Id, tab3Id, 0)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      expect.any(String),
      blockGroup1Id,
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('when moving the last tab in a block, delete block', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    ungroupTab(yLayout, blockGroup3Id, tab3Id, 0)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      expect.any(String),
      blockGroup1Id,
      blockGroup2Id,
    ])
  })
})

describe('canReorderTab', () => {
  test('returns false if tabs are the same', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab1Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab1Id, 'right')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup2Id, tab2Id, tab2Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup2Id, tab2Id, tab2Id, 'right')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup3Id, tab3Id, tab3Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup3Id, tab3Id, tab3Id, 'right')).toBe(
      false
    )
  })

  test('returns false if tabs are not in the same block group', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab2Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab3Id, 'right')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup2Id, tab2Id, tab1Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup2Id, tab2Id, tab3Id, 'right')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup3Id, tab3Id, tab1Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup3Id, tab3Id, tab2Id, 'right')).toBe(
      false
    )
  })

  test('returns false if moving immediately to the left of next tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab2Id, 'left')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab2Id, tab3Id, 'left')).toBe(
      false
    )
  })

  test('returns false if moving immediately to the right of previous tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    expect(canReorderTab(yLayout, blockGroup1Id, tab2Id, tab1Id, 'right')).toBe(
      false
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab3Id, tab2Id, 'right')).toBe(
      false
    )
  })

  test('returns true if moving to valid positions', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    // All valid moves for tab 1
    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab2Id, 'right')).toBe(
      true
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab3Id, 'left')).toBe(
      true
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab1Id, tab3Id, 'right')).toBe(
      true
    )

    // All valid moves for tab 2
    expect(canReorderTab(yLayout, blockGroup1Id, tab2Id, tab1Id, 'left')).toBe(
      true
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab2Id, tab3Id, 'right')).toBe(
      true
    )

    // All valid moves for tab 3
    expect(canReorderTab(yLayout, blockGroup1Id, tab3Id, tab1Id, 'left')).toBe(
      true
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab3Id, tab1Id, 'right')).toBe(
      true
    )
    expect(canReorderTab(yLayout, blockGroup1Id, tab3Id, tab2Id, 'left')).toBe(
      true
    )
  })
})

describe('reorderTab', () => {
  test('can move immediately to the right of next tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    reorderTab(yLayout, blockGroup1Id, tab1Id, tab2Id, 'right')

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('can move immediately to the left of previous tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    reorderTab(yLayout, blockGroup1Id, tab3Id, tab2Id, 'left')

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('can move to the last position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    reorderTab(yLayout, blockGroup1Id, tab1Id, tab3Id, 'right')

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('can move to the first position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    reorderTab(yLayout, blockGroup1Id, tab3Id, tab1Id, 'left')

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })
})

describe('removeBlock', () => {
  test('removes the non-current tab', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    removeBlock(yDoc, blockGroup1Id, tab2Id, false)

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])

    expect(yBlocks.has(tab2Id)).toBe(false)
  })

  test('removing the current tab selects the next', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab1Id)

    removeBlock(yDoc, blockGroup1Id, tab1Id, false)

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])

    expect(yBlocks.has(tab1Id)).toBe(false)
  })

  test('removing the current tab selects the previous if next does not exist', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!
    const tab2Id = getCurrentTabId(yLayout, blockGroup2Id, yBlocks, false)!
    const tab3Id = getCurrentTabId(yLayout, blockGroup3Id, yBlocks, false)!

    // Tab order will be: 1 - 2 - 3
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab3Id)

    removeBlock(yDoc, blockGroup1Id, tab3Id, false)

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])

    expect(yBlocks.has(tab3Id)).toBe(false)
  })
})

describe('duplicateTab', () => {
  it('duplicates the current tab and selects the duplicate', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    const blockGroupId = yLayout.get(0)!.getAttribute('id')!
    const firstTabId = getCurrentTabId(yLayout, blockGroupId, yBlocks, false)!

    const secondTabId = addGroupedBlock(
      yLayout,
      yBlocks,
      blockGroupId,
      firstTabId,
      {
        type: BlockType.SQL,
        dataSourceId: 'something to test the duplication',
        isFileDataSource: false,
      },
      'after'
    )
    expect(secondTabId).toBeTruthy()
    const thirdTabId = addGroupedBlock(
      yLayout,
      yBlocks,
      blockGroupId,
      secondTabId!,
      { type: BlockType.RichText },
      'after'
    )
    expect(thirdTabId).toBeTruthy()

    switchActiveTab(yLayout, blockGroupId, secondTabId!)
    duplicateTab(yLayout, yBlocks, blockGroupId, secondTabId!, false)

    const tabs = getTabsFromBlockGroupId(yLayout, yBlocks, blockGroupId)
    expect(tabs).toHaveLength(4)
    expect(tabs[0]?.blockId).toEqual(firstTabId)
    expect(tabs[1]?.blockId).toEqual(secondTabId)
    expect(tabs[2]?.blockId).not.toEqual(thirdTabId)
    expect(tabs[3]?.blockId).toEqual(thirdTabId)

    const oldBlock = yBlocks.get(secondTabId!)! as Y.XmlElement<SQLBlock>
    expect(oldBlock).toBeDefined()

    const duplicatedBlock = yBlocks.get(
      tabs[2]!.blockId
    ) as Y.XmlElement<SQLBlock>
    expect(duplicatedBlock).toBeDefined()

    expect(duplicatedBlock.getAttribute('dataSourceId')).toEqual(
      oldBlock.getAttribute('dataSourceId')
    )

    const current = getCurrentTabId(yLayout, blockGroupId, yBlocks, false)!
    expect(current).toEqual(tabs[2]?.blockId)
  })
})
