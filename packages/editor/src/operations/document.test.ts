import * as Y from 'yjs'
import {
  addBlockGroup,
  addGroupedBlock,
  checkCanDropBlock,
  checkCanDropBlockGroup,
  duplicateBlockGroup,
  groupBlockGroups,
  groupBlocks,
  removeBlockGroup,
  updateOrder,
} from './document.js'
import {
  YBlockGroup,
  YBlockRef,
  getCurrentTabId,
  getTabsFromBlockGroupId,
  switchActiveTab,
} from './blockGroup.js'
import { BlockType, YBlock, isPythonBlock } from '../blocks/index.js'

let yDoc: Y.Doc
let yBlocks: Y.Map<YBlock>
let yLayout: Y.Array<YBlockGroup>
beforeEach(() => {
  yDoc = new Y.Doc()
  yBlocks = yDoc.getMap('blocks')
  yLayout = yDoc.getArray('layout')
})

describe('addBlockGroup', () => {
  test('adds a block group to the layout', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)

    expect(yLayout.length).toBe(1)

    const blockGroup = yLayout.get(0)
    expect(blockGroup).toBeDefined()

    const blockId = blockGroup.getAttribute('id')
    expect(blockId).toBeDefined()

    const actualTabs = blockGroup
      .getAttribute('tabs')
      ?.map((t) => t.getAttributes())
    const actualCurrent = blockGroup.getAttribute('current')?.getAttributes()

    expect(actualTabs).toEqual([actualCurrent])
  })

  test('adds a python block to the layout', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.Python }, 0)

    const block = Array.from(yBlocks.values())[0]!
    expect(block).toBeDefined()

    expect(isPythonBlock(block)).toBe(true)
  })

  test('adds a block group in the middle of the document', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(2)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!

    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)

    const insertedBlockGroup = yLayout.get(1).getAttribute('id')

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      insertedBlockGroup,
      blockGroup2Id,
    ])
  })

  test('adds a block group to the layout when a group already exists', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    expect(yLayout.length).toBe(2)

    const blockGroup = yLayout.get(1)
    expect(blockGroup).toBeDefined()

    const blockId = blockGroup.getAttribute('id')
    expect(blockId).toBeDefined()

    const actualTabs = blockGroup
      .getAttribute('tabs')
      ?.map((t) => t.getAttributes())
    const actualCurrent = blockGroup.getAttribute('current')?.getAttributes()

    expect(actualTabs).toEqual([actualCurrent])
  })
})

describe('updateOrder', () => {
  test('can move blocks upward in the middle of the document', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    updateOrder(yLayout, blockGroup3Id, 1)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      blockGroup3Id,
      blockGroup2Id,
    ])

    updateOrder(yLayout, blockGroup2Id, 1)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      blockGroup2Id,
      blockGroup3Id,
    ])
  })

  test('can move blocks downward in the middle of the document', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    updateOrder(yLayout, blockGroup1Id, 2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup2Id,
      blockGroup1Id,
      blockGroup3Id,
    ])

    updateOrder(yLayout, blockGroup2Id, 2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      blockGroup2Id,
      blockGroup3Id,
    ])
  })

  test('can move blocks to the first position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    updateOrder(yLayout, blockGroup3Id, 0)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup3Id,
      blockGroup1Id,
      blockGroup2Id,
    ])

    updateOrder(yLayout, blockGroup2Id, 0)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup2Id,
      blockGroup3Id,
      blockGroup1Id,
    ])
  })

  test('can move blocks to the last position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    updateOrder(yLayout, blockGroup1Id, 3)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup2Id,
      blockGroup3Id,
      blockGroup1Id,
    ])

    updateOrder(yLayout, blockGroup2Id, 3)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup3Id,
      blockGroup1Id,
      blockGroup2Id,
    ])
  })
})

describe('groupBlockGroups', () => {
  test('grouping block downwards puts tabs in the beginning', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const group1BeforeTabs: Y.Array<YBlockRef> = yLayout
      .get(0)
      .getAttribute('tabs')!
    const group2BeforeTabs: Y.Array<YBlockRef> = yLayout
      .get(1)
      .getAttribute('tabs')!

    // Calculate expected tabs for first move
    const expectedMergedTabs: { id?: string }[] = []
    group1BeforeTabs.forEach((tab) =>
      expectedMergedTabs.push(tab.getAttributes())
    )
    group2BeforeTabs.forEach((tab) =>
      expectedMergedTabs.push(tab.getAttributes())
    )

    // Group tabs first time
    groupBlockGroups(yLayout, blockGroup1Id, blockGroup2Id)
    expect(yLayout.length).toBe(2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup2Id,
      blockGroup3Id,
    ])

    const blockGroup2Tabs = yLayout.get(0).getAttribute('tabs')!
    expect(blockGroup2Tabs.length).toBe(2)
    expect(blockGroup2Tabs.map((t) => t.getAttributes())).toEqual(
      expectedMergedTabs
    )

    // Calculate expected tabs for second move
    const expectedMergedTabs2: { id?: string }[] = []
    blockGroup2Tabs.forEach((tab) =>
      expectedMergedTabs2.push(tab.getAttributes())
    )
    yLayout
      .get(1)
      .getAttribute('tabs')!
      .forEach((tab) => expectedMergedTabs2.push(tab.getAttributes()))

    // Group tabs second time time
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup3Id)
    expect(yLayout.length).toBe(1)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([blockGroup3Id])

    const blockGroup3Tabs = yLayout.get(0).getAttribute('tabs')!
    expect(blockGroup3Tabs.length).toBe(3)
    expect(blockGroup3Tabs.map((t) => t.getAttributes())).toEqual(
      expectedMergedTabs2
    )
  })

  test('grouping block upwards puts tabs in the beginning', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    const group2BeforeTabs: Y.Array<YBlockRef> = yLayout
      .get(1)
      .getAttribute('tabs')!
    const group3BeforeTabs: Y.Array<YBlockRef> = yLayout
      .get(2)
      .getAttribute('tabs')!

    // Calculate expected tabs for first move
    const expectedMergedTabs: { id?: string }[] = []
    group2BeforeTabs.forEach((tab) =>
      expectedMergedTabs.push(tab.getAttributes())
    )
    group3BeforeTabs.forEach((tab) =>
      expectedMergedTabs.push(tab.getAttributes())
    )

    // Group tabs first time
    groupBlockGroups(yLayout, blockGroup3Id, blockGroup2Id)
    expect(yLayout.length).toBe(2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      blockGroup2Id,
    ])

    const blockGroup2Tabs = yLayout.get(1).getAttribute('tabs')!
    expect(blockGroup2Tabs.length).toBe(2)
    expect(blockGroup2Tabs.map((t) => t.getAttributes())).toEqual(
      expectedMergedTabs
    )

    // Calculate expected tabs for second move
    const expectedMergedTabs2: { id?: string }[] = []
    yLayout
      .get(0)
      .getAttribute('tabs')!
      .forEach((tab) => expectedMergedTabs2.push(tab.getAttributes()))
    blockGroup2Tabs.forEach((tab) =>
      expectedMergedTabs2.push(tab.getAttributes())
    )

    // Group tabs second time time
    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)
    expect(yLayout.length).toBe(1)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([blockGroup1Id])

    const blockGroup1Tabs = yLayout.get(0).getAttribute('tabs')!
    expect(blockGroup1Tabs.length).toBe(3)
    expect(blockGroup1Tabs.map((t) => t.getAttributes())).toEqual(
      expectedMergedTabs2
    )
  })
})

describe('checkCanDrop', () => {
  test('can drop a non-first block group to the first position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    expect(checkCanDropBlockGroup(yLayout, blockGroup2Id, 0)).toBe(true)
    expect(checkCanDropBlockGroup(yLayout, blockGroup3Id, 0)).toBe(true)
  })

  test('can drop a non-last block group to the last position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!

    expect(checkCanDropBlockGroup(yLayout, blockGroup1Id, 3)).toBe(true)
    expect(checkCanDropBlockGroup(yLayout, blockGroup2Id, 3)).toBe(true)
  })

  test('can drop block groups to the middle of the layout', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup3Id = ids[2]!

    expect(checkCanDropBlockGroup(yLayout, blockGroup1Id, 2)).toBe(true)
    expect(checkCanDropBlockGroup(yLayout, blockGroup3Id, 1)).toBe(true)
  })

  test('cannot drop a block group to the same position', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    expect(checkCanDropBlockGroup(yLayout, blockGroup1Id, 0)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, blockGroup1Id, 1)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, blockGroup2Id, 1)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, blockGroup2Id, 2)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, blockGroup3Id, 2)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, blockGroup3Id, 3)).toBe(false)
  })

  test("returns false if the dragged block group doesn't exist", () => {
    expect(checkCanDropBlockGroup(yLayout, 'non-existent', 0)).toBe(false)
    expect(checkCanDropBlockGroup(yLayout, 'non-existent', 1)).toBe(false)
  })
})

describe('removeBlockGroup', () => {
  test('removes a block group from the layout', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!
    const blockGroup3Id = ids[2]!

    expect(yLayout.length).toBe(3)

    removeBlockGroup(yDoc, blockGroup1Id, false)
    expect(yLayout.length).toBe(2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup2Id,
      blockGroup3Id,
    ])

    removeBlockGroup(yDoc, blockGroup3Id, false)
    expect(yLayout.length).toBe(1)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([blockGroup2Id])

    removeBlockGroup(yDoc, blockGroup2Id, false)
    expect(yLayout.length).toBe(0)
  })

  test('ignores non-existent block groups', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)

    const [blockGroup1Id, blockGroup2Id] = yLayout.map((bg) =>
      bg.getAttribute('id')
    ) as string[]

    expect(yLayout.length).toBe(2)

    removeBlockGroup(yDoc, 'does-not-exist', false)
    expect(yLayout.length).toBe(2)
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toEqual([
      blockGroup1Id,
      blockGroup2Id,
    ])
  })
})

describe('checkCanDropBlock', () => {
  test('returns true for dragging a lonely tab multiple blocks above or below', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const blockGroup1Id = yLayout.get(0).getAttribute('id')!
    const blockGroup3Id = yLayout.get(2).getAttribute('id')!

    expect(checkCanDropBlock(yLayout, blockGroup1Id, 2)).toBe(true)
    expect(checkCanDropBlock(yLayout, blockGroup1Id, 3)).toBe(true)
    expect(checkCanDropBlock(yLayout, blockGroup3Id, 1)).toBe(true)
    expect(checkCanDropBlock(yLayout, blockGroup3Id, 0)).toBe(true)
  })

  test('returns false for dragging a lonely tab immediately above or below', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const blockGroup1Id = yLayout.get(0).getAttribute('id')!

    expect(checkCanDropBlock(yLayout, blockGroup1Id, 0)).toBe(false)
    expect(checkCanDropBlock(yLayout, blockGroup1Id, 1)).toBe(false)
  })

  test('returns true for dragging a tab that has siblings immediately above or below', () => {
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 0)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 1)
    addBlockGroup(yLayout, yBlocks, { type: BlockType.RichText }, 2)

    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(3)

    const blockGroup1Id = ids[0]!
    const blockGroup2Id = ids[1]!

    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    expect(checkCanDropBlock(yLayout, blockGroup1Id, 0)).toBe(true)
    expect(checkCanDropBlock(yLayout, blockGroup1Id, 1)).toBe(true)
  })
})

describe('groupBlocks', () => {
  test('removes tab from block group above to block group below', () => {
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

    groupBlockGroups(yLayout, blockGroup2Id, blockGroup1Id)

    // Move tab from first group to last group
    groupBlocks(yLayout, blockGroup1Id, tab2Id, blockGroup3Id)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      blockGroup3Id,
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])

    // Checking correct order
    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('removes tab from block group below to block group above', () => {
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

    groupBlockGroups(yLayout, blockGroup2Id, blockGroup3Id)

    // Move tab from last group to first group
    groupBlocks(yLayout, blockGroup3Id, tab2Id, blockGroup1Id)

    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      blockGroup3Id,
    ])

    // Checking correct order
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

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('moving the only tab of a block to block below', () => {
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

    // Move tab from first group to middle group
    groupBlocks(yLayout, blockGroup1Id, tab1Id, blockGroup2Id)

    // Old group should have been deleted
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup2Id,
      blockGroup3Id,
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup2Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup2Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup2Id,
        isHiddenInPublished: false,
      },
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('moving the only tab of a block to block above', () => {
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

    // Move tab from middle group to first group
    groupBlocks(yLayout, blockGroup2Id, tab2Id, blockGroup1Id)

    // Old group should have been deleted
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      blockGroup3Id,
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

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('moving the current tab selects the next', () => {
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

    // Move tab from middle group to last group and selecting it
    groupBlocks(yLayout, blockGroup2Id, tab2Id, blockGroup3Id)
    switchActiveTab(yLayout, blockGroup3Id, tab2Id)

    // Old block should have been deleted
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      blockGroup3Id,
    ])

    // Move selected tab in the last group
    groupBlocks(yLayout, blockGroup3Id, tab2Id, blockGroup1Id)

    // Expect the current tab in last group to be the next one
    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
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

  test('moving the current tab selects the previous if next does not exist', () => {
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

    // Move tab from middle group to first group and selecting it
    groupBlocks(yLayout, blockGroup2Id, tab2Id, blockGroup1Id)
    switchActiveTab(yLayout, blockGroup1Id, tab2Id)

    // Old block should have been deleted
    expect(yLayout.map((bg) => bg.getAttribute('id'))).toMatchObject([
      blockGroup1Id,
      blockGroup3Id,
    ])

    // Move selected tab in the first group
    groupBlocks(yLayout, blockGroup1Id, tab2Id, blockGroup3Id)

    // Expect the current tab in first group to be the previous one
    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup3Id)).toEqual([
      {
        blockId: tab2Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab3Id,
        type: BlockType.RichText,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup3Id,
        isHiddenInPublished: false,
      },
    ])
  })
})

describe('addGroupedBlock', () => {
  test('adds a tab before current block and focuses it', () => {
    addBlockGroup(
      yLayout,
      yBlocks,
      { type: BlockType.Visualization, dataframeName: null },
      0
    )
    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(1)

    const blockGroup1Id = ids[0]!
    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!

    addGroupedBlock(
      yLayout,
      yBlocks,
      blockGroup1Id,
      tab1Id,
      { type: BlockType.RichText },
      'before'
    )

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: expect.any(String),
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: tab1Id,
        type: BlockType.Visualization,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })

  test('adds a tab after current block and focuses it', () => {
    addBlockGroup(
      yLayout,
      yBlocks,
      { type: BlockType.Visualization, dataframeName: null },
      0
    )
    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(1)

    const blockGroup1Id = ids[0]!
    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!

    addGroupedBlock(
      yLayout,
      yBlocks,
      blockGroup1Id,
      tab1Id,
      { type: BlockType.RichText },
      'after'
    )

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, blockGroup1Id)).toEqual([
      {
        blockId: tab1Id,
        type: BlockType.Visualization,
        title: '',
        isCurrent: false,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
      {
        blockId: expect.any(String),
        type: BlockType.RichText,
        title: '',
        isCurrent: true,
        blockGroupId: blockGroup1Id,
        isHiddenInPublished: false,
      },
    ])
  })
})

describe('duplicateBlockGroup', () => {
  it('should duplicate the whole block group', () => {
    addBlockGroup(
      yLayout,
      yBlocks,
      { type: BlockType.Visualization, dataframeName: null },
      0
    )
    const ids = yLayout.map((bg) => bg.getAttribute('id'))
    expect(ids).toHaveLength(1)

    const blockGroup1Id = ids[0]!
    const tab1Id = getCurrentTabId(yLayout, blockGroup1Id, yBlocks, false)!

    duplicateBlockGroup(yLayout, yBlocks, blockGroup1Id, false)

    const newIds = yLayout.map((bg) => bg.getAttribute('id'))
    expect(newIds).toHaveLength(2)

    const newBlockGroup1Id = newIds[0]!
    const newBlockGroup2Id = newIds[1]!

    expect(newBlockGroup1Id).not.toEqual(newBlockGroup2Id)

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, newBlockGroup1Id)).toEqual(
      [
        {
          blockId: tab1Id,
          type: BlockType.Visualization,
          title: '',
          isCurrent: true,
          blockGroupId: newBlockGroup1Id,
          isHiddenInPublished: false,
        },
      ]
    )

    expect(getTabsFromBlockGroupId(yLayout, yBlocks, newBlockGroup2Id)).toEqual(
      [
        {
          // expect a different id for the duplicated tab inside the block group
          blockId: expect.not.stringMatching(tab1Id),
          type: BlockType.Visualization,
          title: '',
          isCurrent: true,
          blockGroupId: newBlockGroup2Id,
          isHiddenInPublished: false,
        },
      ]
    )
  })
})
