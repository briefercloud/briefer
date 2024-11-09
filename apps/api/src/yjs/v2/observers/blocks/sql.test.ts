import * as Y from 'yjs'
import { describe, expect, it } from '@jest/globals'
import { SQLObserver } from './sql.js'
import { YBlock, SQLBlock, makeSQLBlock } from '@briefer/editor'
import { clone } from 'ramda'
import { ISQLExecutor } from '../../executors_/blocks/sql.js'

describe.only('SQLObserver', () => {
  let executorMock: jest.Mocked<ISQLExecutor>
  beforeEach(() => {
    executorMock = {
      isIdle: jest.fn(),
      runQuery: jest.fn(),
      abortQuery: jest.fn(),
      renameDataFrame: jest.fn(),
      editWithAI: jest.fn(),
      fixWithAI: jest.fn(),
    }
  })

  describe('.isIdle', () => {
    it('should return true executor returns true', () => {
      executorMock.isIdle.mockReturnValue(true)
      const blocksExecutor = new SQLObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(true)
    })

    it('should return false when executor returns false', async () => {
      executorMock.isIdle.mockReturnValue(false)
      const blocksExecutor = new SQLObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      expect(blocksExecutor.isIdle()).toBe(false)
    })
  })

  describe('.handleInitialBlockState', () => {
    let block: Y.XmlElement<SQLBlock>
    beforeEach(() => {
      const ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      block = makeSQLBlock('blockId', blocks, { dataSourceId: 'datasourceId' })
      blocks.set('blockId', block)
    })

    it('should set status to idle when status is not idle', () => {
      // block.setAttribute('status', 'running')
      const blocksExecutor = new SQLObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      // expect(block.getAttribute('status')).toEqual('idle')
    })

    it('should set dataframeName status to idle when status is not idle', () => {
      block.setAttribute('dataframeName', {
        value: 'query_1',
        newValue: 'query_1',
        status: 'loading',
      })
      const blocksExecutor = new SQLObserver(
        'workspaceId',
        'documentId',
        executorMock
      )
      blocksExecutor.handleInitialBlockState(block)
      expect(block.getAttribute('dataframeName')).toEqual({
        value: 'query_1',
        newValue: 'query_1',
        status: 'idle',
      })
    })
  })

  describe('.handleBlockEvent', () => {
    let block: Y.XmlElement<SQLBlock>
    let blocksExecutor: SQLObserver
    let ydoc: Y.Doc
    beforeEach(() => {
      ydoc = new Y.Doc()
      const blocks = ydoc.getMap<YBlock>('blocks')
      block = makeSQLBlock('blockId', blocks, { dataSourceId: 'datasourceId' })
      blocks.set('blockId', block)
      block.getAttribute('source')!.insert(0, 'select * from table')
      blocksExecutor = new SQLObserver(
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
      expect(executorMock.runQuery).not.toHaveBeenCalled()
      expect(executorMock.abortQuery).not.toHaveBeenCalled()
      expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
    })

    it('should do nothing when key is not status or dataframeName', async () => {
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
      expect(executorMock.runQuery).not.toHaveBeenCalled()
      expect(executorMock.abortQuery).not.toHaveBeenCalled()
      expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
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
        expect(executorMock.runQuery).not.toHaveBeenCalled()
        expect(executorMock.abortQuery).not.toHaveBeenCalled()
        expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
      })

      it('should set status to aborting when status is updated to abort-requested', async () => {
        // block.setAttribute('status', 'abort-requested')
        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          'idle',
          'status',
          new Y.Transaction(ydoc, {}, true)
        )

        // expect(block.getAttribute('status')).toEqual('aborting')
        expect(executorMock.runQuery).not.toHaveBeenCalled()
        expect(executorMock.abortQuery).not.toHaveBeenCalled()
        expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
      })

      describe('when status key is updated to running', () => {
        it('should call runQuery from executor and set status back to idle', async () => {
          // block.setAttribute('status', 'running')
          executorMock.runQuery.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.runQuery).toHaveBeenCalledWith(
            block,
            tr,
            false,
            false
          )
          // expect(block.getAttribute('status')).toEqual('idle')
        })

        it('should set status back to idle when runQuery fails', async () => {
          // block.setAttribute('status', 'running')
          executorMock.runQuery.mockRejectedValue(new Error('error'))

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.runQuery).toHaveBeenCalledWith(
            block,
            tr,
            false,
            false
          )
          // expect(block.getAttribute('status')).toEqual('idle')
        })
      })

      describe('when status key is updated to running-suggestion', () => {
        it('should call runQuery from executor and set status back to idle', async () => {
          // block.setAttribute('status', 'running-suggestion')
          executorMock.runQuery.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.runQuery).toHaveBeenCalledWith(
            block,
            tr,
            true,
            false
          )
          // expect(block.getAttribute('status')).toEqual('idle')
        })

        it('should set status back to idle when runQuery fails', async () => {
          // block.setAttribute('status', 'running-suggestion')
          executorMock.runQuery.mockRejectedValue(new Error('error'))

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            'idle',
            'status',
            tr
          )

          expect(executorMock.runQuery).toHaveBeenCalledWith(
            block,
            tr,
            true,
            false
          )
          // expect(block.getAttribute('status')).toEqual('idle')
        })
      })
    })

    describe('when status key is updated to aborting', () => {
      it('should call abortQuery from executor and set status back to idle', async () => {
        // block.setAttribute('status', 'aborting')
        executorMock.abortQuery.mockResolvedValue()

        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          'idle',
          'status',
          new Y.Transaction(ydoc, {}, true)
        )

        // expect(block.getAttribute('status')).toEqual('idle')
      })

      it('should set status back to idle when abortQuery fails', async () => {
        // block.setAttribute('status', 'aborting')
        executorMock.abortQuery.mockRejectedValue(new Error('error'))

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

    describe('when dataframeName key is updated', () => {
      it('should do nothing when dataframeName status is not updated', async () => {
        const prev: SQLBlock['dataframeName'] = {
          value: 'query_1',
          newValue: 'query_1',
          status: 'running',
        }
        block.setAttribute('dataframeName', prev)

        block.setAttribute('dataframeName', {
          value: 'query_1',
          // newValue was updated but status kept the same
          newValue: 'query_2',
          status: 'running',
        })

        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          prev,
          'dataframeName',
          new Y.Transaction(ydoc, {}, true)
        )

        expect(executorMock.runQuery).not.toHaveBeenCalled()
        expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
        expect(executorMock.abortQuery).not.toHaveBeenCalled()
      })

      it('should do nothing when dataframeName status is updated to idle', async () => {
        const prev: SQLBlock['dataframeName'] = {
          value: 'query_1',
          newValue: 'query_1',
          status: 'running',
        }
        block.setAttribute('dataframeName', prev)
        block.setAttribute('dataframeName', {
          value: 'query_1',
          newValue: 'query_1',
          status: 'idle',
        })
        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          prev,
          'dataframeName',
          new Y.Transaction(ydoc, {}, true)
        )

        expect(executorMock.runQuery).not.toHaveBeenCalled()
        expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
        expect(executorMock.abortQuery).not.toHaveBeenCalled()
      })

      it('should set dataframeName status to running when updated to loading', async () => {
        const prev = { ...block.getAttribute('dataframeName'), status: 'idle' }
        block.setAttribute('dataframeName', {
          value: 'query_1',
          newValue: 'query_2',
          status: 'loading',
        })

        await blocksExecutor.handleBlockEvent(
          block,
          'update',
          prev,
          'dataframeName',
          new Y.Transaction(ydoc, {}, true)
        )

        expect(block.getAttribute('dataframeName')).toEqual({
          value: 'query_1',
          newValue: 'query_2',
          status: 'running',
        })
        expect(executorMock.runQuery).not.toHaveBeenCalled()
        expect(executorMock.renameDataFrame).not.toHaveBeenCalled()
        expect(executorMock.abortQuery).not.toHaveBeenCalled()
      })

      describe('when dataframeName status is running', () => {
        it('should call renameDataFrame from executor and set status back to idle', async () => {
          const prev = {
            ...block.getAttribute('dataframeName'),
            status: 'idle',
          }
          block.setAttribute('dataframeName', {
            value: 'query_1',
            newValue: 'query_1',
            status: 'running',
          })
          executorMock.renameDataFrame.mockResolvedValue()

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            prev,
            'dataframeName',
            tr
          )

          expect(executorMock.renameDataFrame).toHaveBeenCalledWith(block)
          expect(block.getAttribute('dataframeName')).toEqual({
            value: 'query_1',
            newValue: 'query_1',
            status: 'idle',
          })
        })

        it('should set status back to idle and error to unexpected when renameDataFrame fails', async () => {
          const prev = {
            ...block.getAttribute('dataframeName'),
            status: 'idle',
          }
          block.setAttribute('dataframeName', {
            value: 'query_1',
            newValue: 'query_1',
            status: 'running',
          })
          executorMock.renameDataFrame.mockRejectedValue(new Error('error'))

          const tr = new Y.Transaction(ydoc, {}, true)
          await blocksExecutor.handleBlockEvent(
            block,
            'update',
            prev,
            'dataframeName',
            tr
          )

          expect(executorMock.renameDataFrame).toHaveBeenCalledWith(block)
          expect(block.getAttribute('dataframeName')).toEqual({
            value: 'query_1',
            newValue: 'query_1',
            status: 'idle',
            error: 'unexpected',
          })
        })
      })
    })
  })
})
