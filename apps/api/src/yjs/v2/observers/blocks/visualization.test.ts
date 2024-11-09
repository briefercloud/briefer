import * as Y from 'yjs'
import { VisualizationObserver } from './visualization.js'
import {
  YBlock,
  VisualizationBlock,
  makeVisualizationBlock,
} from '@briefer/editor'
import { clone } from 'ramda'
import { IVisualizationExecutor } from '../../executors_/blocks/visualization.js'

describe('VisualizationObserver', () => {
  let executorMock: jest.Mocked<IVisualizationExecutor>
  beforeEach(() => {
    executorMock = {
      isIdle: jest.fn(),
      run: jest.fn(),
      abort: jest.fn(),
    }
  })

  describe('.isIdle', () => {
    it('should return true executor returns true', () => {
      executorMock.isIdle.mockReturnValue(true)
      const blocksExecutor = new VisualizationObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(true)
    })

    it('should return false when executor returns false', async () => {
      executorMock.isIdle.mockReturnValue(false)
      const blocksExecutor = new VisualizationObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(false)
    })
  })

  describe('.handleInitialBlockState', () => {
    it('should set status to idle when status is not idle', () => {
      const ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      const block = makeVisualizationBlock('blockId')
      blocks.set('blockId', block)
      // block.setAttribute('status', 'running')
      const blocksExecutor = new VisualizationObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      // expect(block.getAttribute('status')).toEqual('idle')
    })
  })

  describe('.handleBlockEvent', () => {
    let block: Y.XmlElement<VisualizationBlock>
    let visualizationObserver: VisualizationObserver
    let ydoc: Y.Doc
    beforeEach(() => {
      ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      block = makeVisualizationBlock('blockId')
      blocks.set('blockId', block)
      visualizationObserver = new VisualizationObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
    })

    it('should do nothing when action is not update', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        visualizationObserver.handleBlockEvent(
          block,
          'add',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
        visualizationObserver.handleBlockEvent(
          block,
          'delete',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
        visualizationObserver.handleBlockEvent(
          block,
          'batman',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.run).not.toHaveBeenCalled()
    })

    it('should do nothing when key is not status', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        visualizationObserver.handleBlockEvent(
          block,
          'update',
          {},
          'result',
          new Y.Transaction(ydoc, {}, true)
        ),
        visualizationObserver.handleBlockEvent(
          block,
          'update',
          {},
          'batman',
          new Y.Transaction(ydoc, {}, true)
        ),
        visualizationObserver.handleBlockEvent(
          block,
          'update',
          {},
          'robin',
          new Y.Transaction(ydoc, {}, true)
        ),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.run).not.toHaveBeenCalled()
    })

    describe('when status key is updated', () => {
      describe('to run-requested', () => {
        it('should abort current runs and set status to running', async () => {
          // block.setAttribute('status', 'run-requested')
          executorMock.abort.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await visualizationObserver.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.abort).toHaveBeenCalledWith(block)
          // expect(block.getAttribute('status')).toEqual('running')
        })
      })

      describe('to running', () => {
        it('should call executor to run, set status to idle if executor is idle and error to null', async () => {
          // block.setAttribute('status', 'running')
          executorMock.run.mockResolvedValue()
          executorMock.isIdle.mockReturnValue(true)

          const tr = new Y.Transaction(ydoc, {}, true)
          await visualizationObserver.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          // expect(block.getAttribute('status')).toEqual('idle')
          expect(block.getAttribute('error')).toBeNull()
          expect(executorMock.run).toHaveBeenCalledWith(block, tr)
        })

        it('should not set status to idle if executor is not idle', async () => {
          // block.setAttribute('status', 'running')
          executorMock.run.mockResolvedValue()
          executorMock.isIdle.mockReturnValue(false)

          const tr = new Y.Transaction(ydoc, {}, true)
          await visualizationObserver.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          // expect(block.getAttribute('status')).toEqual('running')
          expect(block.getAttribute('error')).toBeNull()
          expect(executorMock.run).toHaveBeenCalledWith(block, tr)
        })

        it('should set status to idle when executor fails', async () => {
          // block.setAttribute('status', 'running')
          executorMock.run.mockRejectedValue(new Error('error'))

          const tr = new Y.Transaction(ydoc, {}, true)
          await visualizationObserver.handleBlockEvent(
            block,
            'update',
            'run-requested',
            'status',
            tr
          )

          // expect(block.getAttribute('status')).toEqual('idle')
          expect(executorMock.run).toHaveBeenCalledWith(block, tr)
        })
      })
    })
  })
})
