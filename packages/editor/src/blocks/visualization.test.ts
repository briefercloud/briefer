import * as Y from 'yjs'
import {
  isVisualizationBlock,
  makeVisualizationBlock,
} from './visualization.js'
import { makeSQLBlock } from './sql.js'
import { BlockType, YBlock } from './index.js'

describe('isYVisualizationBlock', () => {
  it('should return true for Visualization blocks', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const visualizationBlock = makeVisualizationBlock('blockId')
    blocks.set('blockId', visualizationBlock)

    expect(isVisualizationBlock(visualizationBlock)).toBe(true)
  })

  it('should return false for non-Visualization blocks', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const sqlBlock = makeSQLBlock('blockId', blocks)
    blocks.set('blockId', sqlBlock)

    expect(isVisualizationBlock(sqlBlock)).toBe(false)
  })
})

describe('makeVisualizationBlock', () => {
  it('should create a Visualization block with empty source and idle status', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const visualizationBlock = makeVisualizationBlock('blockId')
    blocks.set('blockId', visualizationBlock)

    expect(visualizationBlock.getAttribute('type')).toBe(
      BlockType.Visualization
    )
    expect(visualizationBlock.getAttribute('id')).toBe('blockId')
  })
})
