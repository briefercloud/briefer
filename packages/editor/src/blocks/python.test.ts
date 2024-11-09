import * as Y from 'yjs'
import { isPythonBlock, makePythonBlock } from './python.js'
import { makeSQLBlock } from './sql.js'
import { BlockType, YBlock } from './index.js'

describe('isYPythonBlock', () => {
  it('should return true for Python blocks', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const pythonBlock = makePythonBlock('blockId')
    blocks.set('blockId', pythonBlock)

    expect(isPythonBlock(pythonBlock)).toBe(true)
  })

  it('should return false for non-Python blocks', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const sqlBlock = makeSQLBlock('blockId', blocks)
    blocks.set('blockId', sqlBlock)

    expect(isPythonBlock(sqlBlock)).toBe(false)
  })
})

describe('makePythonBlock', () => {
  it('should create a Python block with empty source and idle status', () => {
    const ydoc = new Y.Doc()
    const blocks = ydoc.getMap<YBlock>('blocks')
    const pythonBlock = makePythonBlock('blockId')
    blocks.set('blockId', pythonBlock)

    expect(pythonBlock.getAttribute('type')).toBe(BlockType.Python)
    expect(pythonBlock.getAttribute('id')).toBe('blockId')
    expect(pythonBlock.getAttribute('source')?.toString()).toBe('')
  })
})
