import * as Y from 'yjs'
import PQueue from 'p-queue'
import { InputEffects, InputExecutor } from './input.js'
import {
  YBlock,
  InputBlock,
  makeInputBlock,
  updateInputValue,
  updateInputVariable,
} from '@briefer/editor'

describe('InputExecutor', () => {
  let block: Y.XmlElement<InputBlock>
  let blocksExecutor: InputExecutor
  let effects: jest.Mocked<InputEffects>
  let blocks: Y.Map<YBlock>
  let queue: PQueue
  beforeEach(() => {
    const ydoc = new Y.Doc()
    blocks = ydoc.getMap<YBlock>('blocks')
    block = makeInputBlock('blockId', blocks)
    blocks.set('blockId', block)
    effects = {
      setVariable: jest.fn(),
    }

    queue = new PQueue({ concurrency: 1 })
    blocksExecutor = new InputExecutor(
      'workspaceId',
      'documentId',
      blocks,
      queue,
      effects
    )
  })

  describe('.isIdle', () => {
    it('should return true when the executionQueue is empty', () => {
      expect(blocksExecutor.isIdle()).toBe(true)
    })

    it('should return false when the executionQueue is not empty', async () => {
      queue.add(() => Promise.resolve())
      expect(blocksExecutor.isIdle()).toBe(false)
    })

    it('should return false when the executionQueue is empty but one item is still executing', async () => {
      const queue = new PQueue({ concurrency: 1 })
      const blocksExecutor = new InputExecutor(
        'workspaceId',
        'documentId',
        new Y.Map(),
        queue
      )
      // never resolve the promise
      queue.add(() => new Promise(() => {}))
      // let the item execute
      // give it a tick to start executing
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(queue.size).toBe(0)
      expect(blocksExecutor.isIdle()).toBe(false)
    })
  })

  describe('saveVariable', () => {
    it('should set error to invalid-variable-name when newValue is invalid', async () => {
      updateInputVariable(block, blocks, {
        status: 'saving',
        newValue: 'invalid variable',
      })

      await blocksExecutor.saveVariable(block)

      expect(block.getAttribute('variable')).toHaveProperty(
        'error',
        'invalid-variable-name'
      )
    })

    it('should update variable in block after perform setVariable effect', async () => {
      updateInputValue(block, { value: 'value' })

      updateInputVariable(block, blocks, { value: 'old_variable' })
      updateInputVariable(block, blocks, {
        status: 'saving',
        newValue: 'new_variable',
      })

      effects.setVariable.mockResolvedValue({
        promise: Promise.resolve(),
        abort: jest.fn(),
      })
      await blocksExecutor.saveVariable(block)

      expect(effects.setVariable).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'new_variable',
        'value'
      )
      const variable = block.getAttribute('variable')
      expect(variable).toHaveProperty('value', 'new_variable')
      expect(variable).toHaveProperty('newValue', 'new_variable')
      expect(variable).toHaveProperty('error', null)
    })
  })

  describe('.saveValue', () => {
    it('should update value in block after perform setVariable effect', async () => {
      updateInputValue(block, { value: 'old_value' })
      updateInputValue(block, { status: 'saving', newValue: 'new_value' })

      effects.setVariable.mockResolvedValue({
        promise: Promise.resolve(),
        abort: jest.fn(),
      })
      await blocksExecutor.saveValue(block)

      expect(effects.setVariable).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'input_1',
        'new_value'
      )
      const value = block.getAttribute('value')
      expect(value).toHaveProperty('value', 'new_value')
      expect(value).toHaveProperty('newValue', 'new_value')
      expect(value).toHaveProperty('error', null)
    })
  })
})
