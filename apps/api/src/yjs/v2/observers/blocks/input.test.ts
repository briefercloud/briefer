import * as Y from 'yjs'
import { InputObserver } from './input.js'
import {
  YBlock,
  InputBlock,
  makeInputBlock,
  updateInputValue,
  updateInputVariable,
  getInputAttributes,
} from '@briefer/editor'
import { clone } from 'ramda'
import { IInputExecutor } from '../../executors_/blocks/input.js'

describe('InputObserver', () => {
  let executorMock: jest.Mocked<IInputExecutor>
  beforeEach(() => {
    executorMock = {
      isIdle: jest.fn(),
      saveVariable: jest.fn(),
      saveValue: jest.fn(),
      abortSaveValue: jest.fn(),
    }
  })

  describe('.isIdle', () => {
    it('should return true executor returns true', () => {
      executorMock.isIdle.mockReturnValue(true)
      const blocksExecutor = new InputObserver(
        'workspaceId',
        'documentId',
        new Y.Map(),
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(true)
    })

    it('should return false when executor returns false', async () => {
      executorMock.isIdle.mockReturnValue(false)
      const blocksExecutor = new InputObserver(
        'workspaceId',
        'documentId',
        new Y.Map(),
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(false)
    })
  })

  describe('.handleInitialBlockState', () => {
    it('should set value status to idle when value status is not idle', () => {
      const ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      const block = makeInputBlock('blockId', blocks)
      blocks.set('blockId', block)
      updateInputValue(block, { status: 'save-requested' })
      const blocksExecutor = new InputObserver(
        'workspaceId',
        'documentId',
        new Y.Map(),
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      const value = block.getAttribute('value')
      expect(value?.status).toBe('idle')
    })

    it('should set variable status to idle when variable status is not idle', () => {
      const ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      const block = makeInputBlock('blockId', blocks)
      blocks.set('blockId', block)
      updateInputVariable(block, blocks, { status: 'save-requested' })
      const blocksExecutor = new InputObserver(
        'workspaceId',
        'documentId',
        new Y.Map(),
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      const variable = block.getAttribute('variable')
      expect(variable?.status).toBe('idle')
    })
  })

  describe('.handleBlockEvent', () => {
    let block: Y.XmlElement<InputBlock>
    let blocksExecutor: InputObserver
    let blocks: Y.Map<YBlock>
    beforeEach(() => {
      const ydoc = new Y.Doc()
      blocks = ydoc.getMap<YBlock>('blocks')
      block = makeInputBlock('blockId', blocks)
      blocks.set('blockId', block)
      blocksExecutor = new InputObserver(
        'workspaceId',
        'documentId',
        blocks,
        executorMock
      )
    })

    it('should do nothing when action is not update', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        blocksExecutor.handleBlockEvent(block, 'add', {}, 'status'),
        blocksExecutor.handleBlockEvent(block, 'delete', {}, 'status'),
        blocksExecutor.handleBlockEvent(block, 'batman', {}, 'status'),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.saveValue).not.toHaveBeenCalled()
      expect(executorMock.saveVariable).not.toHaveBeenCalled()
    })

    it('should do nothing when key is not status', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        blocksExecutor.handleBlockEvent(block, 'update', {}, 'result'),
        blocksExecutor.handleBlockEvent(block, 'update', {}, 'batman'),
        blocksExecutor.handleBlockEvent(block, 'update', {}, 'robin'),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.saveValue).not.toHaveBeenCalled()
      expect(executorMock.saveVariable).not.toHaveBeenCalled()
    })

    describe('when value key is updated', () => {
      it('should ignore when status is not changed', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).value,
          status: 'saving',
        }
        updateInputValue(block, {
          status: 'saving',
          // changing newValue just to simulate a change that should be ignored
          newValue: 'newValue',
        })
        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'variable')

        expect(executorMock.saveVariable).not.toHaveBeenCalled()
        expect(executorMock.saveValue).not.toHaveBeenCalled()
      })

      it('should set value status to saving when value status is updated to save-requested', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).value,
          status: 'idle',
        }
        updateInputValue(block, { status: 'save-requested' })
        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'value')

        expect(block.getAttribute('value')?.status).toEqual('saving')
        expect(executorMock.saveValue).not.toHaveBeenCalled()
        expect(executorMock.saveVariable).not.toHaveBeenCalled()
      })

      describe('to saving', () => {
        it('should call executor to saveValue set status to idle and error to null', async () => {
          const prev = {
            ...getInputAttributes(block, blocks).value,
            status: 'save-requested',
          }
          updateInputValue(block, { status: 'saving' })
          executorMock.saveValue.mockResolvedValue()

          await blocksExecutor.handleBlockEvent(block, 'update', prev, 'value')

          expect(executorMock.saveValue).toHaveBeenCalledWith(block)
          expect(block.getAttribute('value')).toHaveProperty('status', 'idle')
          expect(block.getAttribute('value')).toHaveProperty('error', null)
        })

        it('should set error to unexpected-error when executor fails', async () => {
          const prev = {
            ...getInputAttributes(block, blocks).value,
            status: 'save-requested',
          }
          updateInputValue(block, { status: 'saving' })

          executorMock.saveValue.mockRejectedValue(
            new Error('unexpected-error')
          )

          await blocksExecutor.handleBlockEvent(block, 'update', prev, 'value')

          expect(executorMock.saveValue).toHaveBeenCalledWith(block)
          expect(block.getAttribute('value')).toHaveProperty('status', 'idle')
          expect(block.getAttribute('value')).toHaveProperty(
            'error',
            'unexpected-error'
          )
        })
      })
    })

    describe('when variable key is updated', () => {
      it('should ignore when status is not changed', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).variable,
          status: 'saving',
        }
        updateInputVariable(block, blocks, {
          status: 'saving',
          // changing newValue just to simulate a change that should be ignored
          newValue: 'newValue',
        })
        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'variable')

        expect(executorMock.saveVariable).not.toHaveBeenCalled()
        expect(executorMock.saveValue).not.toHaveBeenCalled()
      })

      it('should set variable status to saving when variable status is updated to run-requested', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).variable,
          status: 'idle',
        }
        updateInputVariable(block, blocks, { status: 'save-requested' })
        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'variable')

        expect(block.getAttribute('variable')?.status).toEqual('saving')
        expect(executorMock.saveVariable).not.toHaveBeenCalled()
        expect(executorMock.saveValue).not.toHaveBeenCalled()
      })

      it('should call executor to saveVariable set status to idle and error to null', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).variable,
          status: 'save-requested',
        }
        updateInputVariable(block, blocks, {
          status: 'saving',
        })

        executorMock.saveVariable.mockResolvedValue()
        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'variable')

        expect(executorMock.saveVariable).toHaveBeenCalledWith(block)
        expect(block.getAttribute('variable')).toHaveProperty('status', 'idle')
        expect(block.getAttribute('variable')).toHaveProperty('error', null)
      })

      it('should set error to unexpected-error when executor fails', async () => {
        const prev = {
          ...getInputAttributes(block, blocks).variable,
          status: 'save-requested',
        }
        updateInputVariable(block, blocks, {
          status: 'saving',
        })

        executorMock.saveVariable.mockRejectedValue(
          new Error('unexpected-error')
        )

        await blocksExecutor.handleBlockEvent(block, 'update', prev, 'variable')

        expect(block.getAttribute('variable')).toHaveProperty('status', 'idle')
        expect(block.getAttribute('variable')).toHaveProperty(
          'error',
          'unexpected-error'
        )
      })
    })
  })
})
