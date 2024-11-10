import * as Y from 'yjs'
import { describe, expect, it } from '@jest/globals'
import PQueue from 'p-queue'
import { SQLEffects, SQLExecutor } from './sql.js'
import {
  YBlock,
  SQLBlock,
  makeSQLBlock,
  getBaseAttributes,
} from '@briefer/editor'
import { DataSource } from '@briefer/database'
import {
  DataFrame,
  RunQueryResult,
  SQLQueryConfiguration,
  SuccessRunQueryResult,
} from '@briefer/types'
import { SQLEvents } from '../../../../events/index.js'
import { IJupyterManager } from '../../../../jupyter/index.js'

describe('SQLExecutor', () => {
  let ydoc: Y.Doc
  let block: Y.XmlElement<SQLBlock>
  let blocksExecutor: SQLExecutor
  let effects: jest.Mocked<SQLEffects>
  let events: jest.Mocked<SQLEvents>
  let dataframes: Y.Map<DataFrame>
  let blocks: Y.Map<YBlock>
  let jupyterManager: jest.Mocked<IJupyterManager>
  let queue: PQueue
  beforeEach(() => {
    ydoc = new Y.Doc()
    dataframes = ydoc.getMap<DataFrame>('dataframes')
    blocks = ydoc.getMap<YBlock>('blocks')
    block = makeSQLBlock('blockId', blocks, { dataSourceId: 'datasourceId' })
    blocks.set('blockId', block)
    block.getAttribute('source')!.insert(0, 'print("3")')

    effects = {
      makeSQLQuery: jest.fn(),
      renameDataFrame: jest.fn(),
      listDataSources: jest.fn(),
      listDataFrames: jest.fn(),
      editWithAI: jest.fn(),
      documentHasRunSQLSelectionEnabled: jest.fn(),
    }
    events = {
      aiUsage: jest.fn(),
      sqlRun: jest.fn(),
    }
    jupyterManager = {
      start: jest.fn(),
      stop: jest.fn(),
      deploy: jest.fn(),
      restart: jest.fn(),
      ensureRunning: jest.fn(),
      isRunning: jest.fn(),
      fileExists: jest.fn(),
      listFiles: jest.fn(),
      getFile: jest.fn(),
      putFile: jest.fn(),
      deleteFile: jest.fn(),
      getServerSettings: jest.fn(),
      setEnvironmentVariables: jest.fn(),
    }
    queue = new PQueue({ concurrency: 1 })
    blocksExecutor = new SQLExecutor(
      'workspaceId',
      'documentId',
      'dataSourcesEncryptionKey',
      dataframes,
      blocks,
      queue,
      jupyterManager,
      effects,
      events
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
      // never resolve the promise
      queue.add(() => new Promise(() => {}))
      // let the item execute
      // give it a tick to start executing
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(queue.size).toBe(0)
      expect(blocksExecutor.isIdle()).toBe(false)
    })
  })

  describe('runQuery', () => {
    it('should execute sql by performing makeSQLQuery effect', async () => {
      // block.setAttribute('status', 'running')
      const prevTime = new Date(Date.now() - 1000 * 60)
      block.setAttribute('lastQueryTime', prevTime.toISOString())
      // @ts-ignore
      const datasource: DataSource = { data: { id: 'datasourceId' } }
      effects.listDataSources.mockResolvedValue([datasource])
      const result: SuccessRunQueryResult = {
        type: 'success',
        columns: [{ name: 'a', type: 'int' }],
        rows: [],
        count: 0,
      }
      effects.makeSQLQuery.mockImplementationOnce(
        (
          _workspaceId: string,
          _sessionId: string,
          _queryId: string,
          _dataframeName: string,
          _datasource: DataSource | 'duckdb',
          _encryptionKey: string,
          _sql: string,
          onProgress: (result: SuccessRunQueryResult) => void,
          _configuration: SQLQueryConfiguration | null
        ) => {
          onProgress(result)
          return Promise.resolve([Promise.resolve(result), jest.fn()])
        }
      )

      await blocksExecutor.runQuery(
        block,
        new Y.Transaction(ydoc, {}, true),
        false,
        false
      )

      expect(effects.makeSQLQuery).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'blockId',
        'query_1',
        datasource,
        'dataSourcesEncryptionKey',
        'print("3")',
        expect.any(Function),
        null
      )
      expect(block.getAttribute('result')).toEqual(result)
      expect(Array.from(dataframes.entries())).toEqual([
        [
          'query_1',
          {
            id: 'blockId',
            name: 'query_1',
            columns: [{ name: 'a', type: 'int' }],
            updatedAt: expect.any(String),
            blockId: getBaseAttributes(block).id,
          },
        ],
      ])
    })

    it('should try AI suggestion for sql when calling run as a suggestion attempt', async () => {
      // block.setAttribute('status', 'running')
      const prevTime = new Date(Date.now() - 1000 * 60)
      block.setAttribute('lastQueryTime', prevTime.toISOString())
      // @ts-ignore
      const datasource: DataSource = { data: { id: 'datasourceId' } }
      effects.listDataSources.mockResolvedValue([datasource])
      const result: SuccessRunQueryResult = {
        type: 'success',
        columns: [{ name: 'a', type: 'int' }],
        rows: [],
        count: 0,
      }
      effects.makeSQLQuery.mockImplementationOnce(
        (
          _workspaceId: string,
          _sessionId: string,
          _queryId: string,
          _dataframeName: string,
          _datasource: DataSource | 'duckdb',
          _encryptionKey: string,
          _sql: string,
          onProgress: (result: SuccessRunQueryResult) => void,
          _configuration: SQLQueryConfiguration | null
        ) => {
          onProgress(result)
          return Promise.resolve([Promise.resolve(result), jest.fn()])
        }
      )

      block.setAttribute('aiSuggestions', new Y.Text('print("1337")'))
      await blocksExecutor.runQuery(
        block,
        new Y.Transaction(ydoc, {}, true),
        true,
        false
      )

      expect(effects.makeSQLQuery).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'blockId',
        'query_1',
        datasource,
        'dataSourcesEncryptionKey',
        'print("1337")',
        expect.any(Function),
        null
      )
      expect(block.getAttribute('result')).toEqual(result)
      expect(Array.from(dataframes.entries())).toEqual([
        [
          'query_1',
          {
            id: 'blockId',
            name: 'query_1',
            columns: [{ name: 'a', type: 'int' }],
            updatedAt: expect.any(String),
            blockId: block.getAttribute('id'),
          },
        ],
      ])
    })

    it('should not crash when execution gets aborted from the queue', async () => {
      let canResolve = false
      queue.add(
        () =>
          new Promise<void>(async (resolve) => {
            while (!canResolve) {
              await new Promise((resolve) => setTimeout(resolve, 0))
            }
            resolve()
          })
      )
      const runningPromise = blocksExecutor.runQuery(
        block,
        new Y.Transaction(ydoc, {}, true),
        false,
        false
      )
      await blocksExecutor.abortQuery(block)
      canResolve = true
      await expect(runningPromise).resolves.toBeUndefined()
      expect(block.getAttribute('result')).toEqual({
        type: 'abort-error',
        message: 'Query aborted',
      })
    })
  })

  describe('abortQuery', () => {
    it('should do nothing when not running', async () => {
      await blocksExecutor.abortQuery(block)
      expect(effects.makeSQLQuery).not.toHaveBeenCalled()
    })

    it('should abort the execution', async () => {
      const abort = jest.fn()
      effects.listDataSources.mockResolvedValue([
        // @ts-ignore
        { data: { id: 'datasourceId' } },
      ])
      effects.makeSQLQuery.mockResolvedValue([
        new Promise(async (resolve) => {
          // only resolve once abort is called
          while (abort.mock.calls.length === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0))
          }

          resolve({
            type: 'abort-error',
            message: 'Query aborted',
          })
        }),
        abort,
      ])
      // block.setAttribute('status', 'running')
      const runningPromise = blocksExecutor.runQuery(
        block,

        new Y.Transaction(ydoc, {}, true),
        false,
        false
      )

      // wait until makeSQLQuery is called
      while (!effects.makeSQLQuery.mock.calls.length) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }

      await blocksExecutor.abortQuery(block)
      expect(abort).toHaveBeenCalled()
      await expect(runningPromise).resolves.toBeUndefined()
      expect(block.getAttribute('result')).toEqual({
        type: 'abort-error',
        message: 'Query aborted',
      })
    })
  })

  // describe('renameDataFrame', () => {
  //   it('should set error to invalid-name when newValue is invalid', async () => {
  //     block.setAttribute('dataframeName', {
  //       value: 'query_1',
  //       newValue: 'invalid name',
  //       status: 'loading',
  //     })

  //     await blocksExecutor.renameDataFrame(block)

  //     expect(block.getAttribute('dataframeName')).toEqual({
  //       value: 'query_1',
  //       newValue: 'invalid name',
  //       status: 'loading',
  //       error: 'invalid-name',
  //     })
  //   })

  //   it('should just update to new value when result is not success', async () => {
  //     const nonSuccessResults: RunQueryResult[] = [
  //       { type: 'abort-error', message: 'Query aborted' },
  //       { type: 'syntax-error', message: 'Syntax error' },
  //       {
  //         type: 'python-error',
  //         ename: 'NameError',
  //         evalue: 'NameError: name "x" is not defined',
  //         traceback: ['line 1', 'line 2'],
  //       },
  //     ]

  //     for (const result of nonSuccessResults) {
  //       block.setAttribute('dataframeName', {
  //         value: 'old_value',
  //         newValue: 'new_value',
  //         status: 'loading',
  //       })
  //       block.setAttribute('result', result)

  //       await blocksExecutor.renameDataFrame(block)

  //       expect(block.getAttribute('dataframeName')).toEqual({
  //         value: 'new_value',
  //         newValue: 'new_value',
  //         status: 'loading',
  //       })
  //       expect(effects.makeSQLQuery).not.toHaveBeenCalled()
  //       expect(effects.renameDataFrame).not.toHaveBeenCalled()
  //       expect(effects.listDataSources).not.toHaveBeenCalled()
  //     }
  //   })

  //   it('should just update to new value when query is running', async () => {
  //     block.setAttribute('dataframeName', {
  //       value: 'old_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     block.setAttribute('result', {
  //       type: 'success',
  //       columns: [],
  //       rows: [],
  //       count: 0,
  //     })
  //     // block.setAttribute('status', 'running')

  //     await blocksExecutor.renameDataFrame(block)

  //     expect(block.getAttribute('dataframeName')).toEqual({
  //       value: 'new_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     expect(effects.makeSQLQuery).not.toHaveBeenCalled()
  //     expect(effects.renameDataFrame).not.toHaveBeenCalled()
  //     expect(effects.listDataSources).not.toHaveBeenCalled()
  //   })

  //   it('should just update to new value in document when jupyter is not running', async () => {
  //     block.setAttribute('dataframeName', {
  //       value: 'old_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     block.setAttribute('result', {
  //       type: 'success',
  //       columns: [],
  //       rows: [],
  //       count: 0,
  //     })
  //     jupyterManager.isRunning.mockResolvedValue(false)

  //     await blocksExecutor.renameDataFrame(block)

  //     expect(block.getAttribute('dataframeName')).toEqual({
  //       value: 'new_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     expect(effects.makeSQLQuery).not.toHaveBeenCalled()
  //     expect(effects.renameDataFrame).not.toHaveBeenCalled()
  //     expect(jupyterManager.isRunning).toHaveBeenCalledWith('workspaceId')
  //     expect(effects.listDataSources).not.toHaveBeenCalled()
  //   })

  //   it('should rename the dataframe in document and jupyter when jupyter is running', async () => {
  //     block.setAttribute('dataframeName', {
  //       value: 'old_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     block.setAttribute('result', {
  //       type: 'success',
  //       columns: [],
  //       rows: [],
  //       count: 0,
  //     })
  //     jupyterManager.isRunning.mockResolvedValue(true)
  //     effects.renameDataFrame.mockResolvedValue()
  //     effects.listDataFrames.mockResolvedValue([
  //       {
  //         name: 'new_value',
  //         columns: [{ name: 'a column', type: 'int' }],
  //       },
  //     ])

  //     await blocksExecutor.renameDataFrame(block)

  //     expect(effects.renameDataFrame).toHaveBeenCalledWith(
  //       'workspaceId',
  //       'documentId',
  //       'old_value',
  //       'new_value'
  //     )
  //     expect(block.getAttribute('dataframeName')).toEqual({
  //       value: 'new_value',
  //       newValue: 'new_value',
  //       status: 'loading',
  //     })
  //     expect(dataframes.get('new_value')).toEqual({
  //       name: 'new_value',
  //       columns: [{ name: 'a column', type: 'int' }],
  //       blockId: getBaseAttributes(block).id,
  //     })
  //     expect(effects.makeSQLQuery).not.toHaveBeenCalled()
  //     expect(jupyterManager.isRunning).toHaveBeenCalledWith('workspaceId')
  //     expect(effects.listDataSources).not.toHaveBeenCalled()
  //     expect(effects.listDataFrames).toHaveBeenCalledWith(
  //       'workspaceId',
  //       'documentId'
  //     )
  //   })
  // })
})
