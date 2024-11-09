import * as Y from 'yjs'
import { PythonObserver } from './python'
import { YBlock, PythonBlock, makePythonBlock } from '@briefer/editor'
import { clone } from 'ramda'
import { IPythonExecutor } from '../../executors_/blocks/python.js'

describe('PythonObserver', () => {
  let executorMock: jest.Mocked<IPythonExecutor>
  beforeEach(() => {
    executorMock = {
      isIdle: jest.fn(),
      run: jest.fn(),
      abort: jest.fn(),
      editWithAI: jest.fn(),
      fixWithAI: jest.fn(),
    }
  })

  describe('.isIdle', () => {
    it('should return true executor returns true', () => {
      executorMock.isIdle.mockReturnValue(true)
      const blocksExecutor = new PythonObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(true)
    })

    it('should return false when executor returns false', async () => {
      executorMock.isIdle.mockReturnValue(false)
      const blocksExecutor = new PythonObserver(
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
      const block = makePythonBlock('blockId')
      blocks.set('blockId', block)
      // block.setAttribute('status', 'running')
      const blocksExecutor = new PythonObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      // expect(block.getAttribute('status')).toEqual('idle')
    })
  })

  describe('.handleBlockEvent', () => {
    let block: Y.XmlElement<PythonBlock>
    let blocksExecutor: PythonObserver
    let ydoc: Y.Doc
    beforeEach(() => {
      ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      block = makePythonBlock('blockId')
      blocks.set('blockId', block)
      block.getAttribute('source')!.insert(0, 'print("3")')
      blocksExecutor = new PythonObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
    })

    it('should do nothing when action is not update', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        blocksExecutor.handleBlockEvent(
          block,
          'add',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
        blocksExecutor.handleBlockEvent(
          block,
          'delete',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
        blocksExecutor.handleBlockEvent(
          block,
          'batman',
          {},
          'status',
          new Y.Transaction(ydoc, {}, true)
        ),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.run).not.toHaveBeenCalled()
      expect(executorMock.abort).not.toHaveBeenCalled()
    })

    it('should do nothing when key is not status', async () => {
      const previousAttributes = clone(block.getAttributes())

      await Promise.all([
        blocksExecutor.handleBlockEvent(
          block,
          'update',
          {},
          'result',
          new Y.Transaction(ydoc, {}, true)
        ),
        blocksExecutor.handleBlockEvent(
          block,
          'update',
          {},
          'batman',
          new Y.Transaction(ydoc, {}, true)
        ),
        blocksExecutor.handleBlockEvent(
          block,
          'update',
          {},
          'robin',
          new Y.Transaction(ydoc, {}, true)
        ),
      ])

      expect(block.getAttributes()).toEqual(previousAttributes)
      expect(executorMock.run).not.toHaveBeenCalled()
      expect(executorMock.abort).not.toHaveBeenCalled()
    })

    describe('when status key is updated', () => {
      it('should set status to running when status is updated to run-requested', async () => {
        // block.setAttribute('status', 'run-requested')
        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          'idle',
          'status',
          new Y.Transaction(ydoc, {}, true)
        )

        // expect(block.getAttribute('status')).toEqual('running')
        expect(executorMock.run).not.toHaveBeenCalled()
        expect(executorMock.abort).not.toHaveBeenCalled()
      })

      it('should set status to aborting when status is updated to abort-requested', async () => {
        // block.setAttribute('status', 'abort-requested')
        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          'running',
          'status',
          new Y.Transaction(ydoc, {}, true)
        )

        // expect(block.getAttribute('status')).toEqual('aborting')
        expect(executorMock.run).not.toHaveBeenCalled()
        expect(executorMock.abort).not.toHaveBeenCalled()
      })

      describe('to running', () => {
        it('should call executor to run python and update status back to idle', async () => {
          // block.setAttribute('status', 'running')
          executorMock.run.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.run).toHaveBeenCalledWith(block, tr, false)
          // expect(block.getAttribute('status')).toEqual('idle')
        })

        it('should update status back to idle when executor fails', async () => {
          // block.setAttribute('status', 'running')
          executorMock.run.mockRejectedValue(new Error('unexpected-error'))

          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            new Y.Transaction(ydoc, {}, true)
          )

          // expect(block.getAttribute('status')).toEqual('idle')
        })
      })

      describe('to running-suggestion', () => {
        it('should call executor to run python and update status back to idle', async () => {
          // block.setAttribute('status', 'running-suggestion')
          executorMock.run.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.run).toHaveBeenCalledWith(block, tr, true)
          // expect(block.getAttribute('status')).toEqual('idle')
        })

        it('should update status back to idle when executor fails', async () => {
          // block.setAttribute('status', 'running-suggestion')
          executorMock.run.mockRejectedValue(new Error('unexpected-error'))

          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            new Y.Transaction(ydoc, {}, true)
          )

          // expect(block.getAttribute('status')).toEqual('idle')
        })
      })

      describe('to aborting', () => {
        it('should call executor to abort python and update status back to idle', async () => {
          // block.setAttribute('status', 'aborting')
          executorMock.abort.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'abort-requested',
            'status',
            tr
          )

          expect(executorMock.abort).toHaveBeenCalledWith(block, tr)
          // expect(block.getAttribute('status')).toEqual('idle')
        })

        it('should update status back to idle when executor fails', async () => {
          // block.setAttribute('status', 'aborting')
          executorMock.abort.mockRejectedValue(new Error('unexpected-error'))

          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'abort-requested',
            'status',
            new Y.Transaction(ydoc, {}, true)
          )

          // expect(block.getAttribute('status')).toEqual('idle')
        })
      })
    })
  })
})
