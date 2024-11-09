import * as Y from 'yjs'
import PQueue from 'p-queue'
import { PythonEffects, PythonExecutor } from './python.js'
import { YBlock, PythonBlock, makePythonBlock } from '@briefer/editor'
import { DataFrame, Output } from '@briefer/types'
import { PythonEvents } from '../../../../events/index.js'

describe('PythonExecutor', () => {
  let ydoc: Y.Doc
  let block: Y.XmlElement<PythonBlock>
  let blocksExecutor: PythonExecutor
  let effects: jest.Mocked<PythonEffects>
  let events: jest.Mocked<PythonEvents>
  let dataframes: Y.Map<DataFrame>
  let blocks: Y.Map<YBlock>
  let queue: PQueue
  beforeEach(() => {
    ydoc = new Y.Doc()
    dataframes = ydoc.getMap<DataFrame>('dataframes')
    blocks = ydoc.getMap<YBlock>('blocks')
    block = makePythonBlock('blockId')
    blocks.set('blockId', block)
    block.getAttribute('source')!.insert(0, 'print("3")')
    effects = {
      executePython: jest.fn(),
      listDataFrames: jest.fn(),
      editWithAI: jest.fn(),
    }
    events = {
      aiUsage: jest.fn(),
      pythonRun: jest.fn(),
    }

    queue = new PQueue({ concurrency: 1 })
    blocksExecutor = new PythonExecutor(
      'workspaceId',
      'documentId',
      dataframes,
      blocks,
      queue,
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

  describe('run', () => {
    it('should execute python by performing executePython effect', async () => {
      // block.setAttribute('status', 'running')
      const prevTime = new Date(Date.now() - 1000 * 60)
      block.setAttribute('lastQueryTime', prevTime.toISOString())
      const result: Output[] = [{ type: 'stdio', name: 'stdout', text: '3' }]
      effects.listDataFrames.mockResolvedValue([
        {
          name: 'df',
          columns: [{ name: 'a', type: 'int' }],
        },
      ])
      effects.executePython = jest.fn(
        async (
          _workspaceId: string,
          _sessionId: string,
          _code: string,
          onOutputs: (outputs: Output[]) => void,
          _opts: { killSession?: boolean; storeHistory: boolean }
        ) => {
          return {
            promise: new Promise<void>((resolve) => {
              onOutputs(result)
              resolve()
            }),
            abort: jest.fn(),
          }
        }
      )
      await blocksExecutor.run(block, new Y.Transaction(ydoc, {}, true), false)

      expect(effects.listDataFrames).toHaveBeenCalledWith(
        'workspaceId',
        'documentId'
      )
      expect(effects.executePython).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'print("3")',
        expect.any(Function),
        { storeHistory: true }
      )
      // expect(block.getAttribute('status')).toEqual('idle')
      expect(block.getAttribute('result')).toEqual(result)
      expect(
        new Date(block.getAttribute('lastQueryTime')!).getTime()
      ).toBeGreaterThan(prevTime.getTime())

      expect(Array.from(dataframes.entries())).toEqual([
        [
          'df',
          {
            name: 'df',
            columns: [{ name: 'a', type: 'int' }],
            blockId: block.getAttribute('id'),
          },
        ],
      ])
    })

    it('should set error states when running python fails', async () => {
      // block.setAttribute('status', 'running')
      const prevTime = new Date(Date.now() - 1000 * 60)
      block.setAttribute('lastQueryTime', prevTime.toISOString())
      const result: Output[] = [
        {
          type: 'error',
          ename: 'life',
          evalue: 'is painful',
          traceback: ['every', 'time'],
        },
      ]
      effects.listDataFrames.mockResolvedValue([
        {
          name: 'df',
          columns: [{ name: 'a', type: 'int' }],
        },
      ])
      effects.executePython = jest.fn(
        async (
          _workspaceId: string,
          _sessionId: string,
          _code: string,
          onOutputs: (outputs: Output[]) => void,
          _opts: { killSession?: boolean; storeHistory: boolean }
        ) => {
          return {
            promise: new Promise<void>((resolve) => {
              onOutputs(result)
              resolve()
            }),
            abort: jest.fn(),
          }
        }
      )
      await blocksExecutor.run(block, new Y.Transaction(ydoc, {}, true), false)

      expect(effects.executePython).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        'print("3")',
        expect.any(Function),
        { storeHistory: true }
      )
      expect(block.getAttribute('result')).toEqual(result)
      expect(
        new Date(block.getAttribute('lastQueryTime')!).getTime()
      ).toBeGreaterThan(prevTime.getTime())
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

      // block.setAttribute('status', 'running')
      const runP = blocksExecutor.run(
        block,
        new Y.Transaction(ydoc, {}, true),
        false
      )

      // abort
      await blocksExecutor.abort(block)
      canResolve = true

      await expect(runP).resolves.toBeUndefined()
    })
  })

  describe('abort', () => {
    it('should do nothing when not running', async () => {
      await expect(blocksExecutor.abort(block)).resolves.toBeUndefined()
    })

    it('should abort the execution', async () => {
      const abort = jest.fn().mockResolvedValue(undefined)
      effects.executePython.mockResolvedValue({
        promise: new Promise(async (resolve) => {
          // only resolve once abort is called
          while (!abort.mock.calls.length) {
            await new Promise((resolve) => setTimeout(resolve, 0))
          }
          resolve()
        }),
        abort,
      })
      // block.setAttribute('status', 'running')
      const runningPromise = blocksExecutor.run(
        block,
        new Y.Transaction(ydoc, {}, true),
        false
      )
      await blocksExecutor.abort(block)
      await runningPromise
      expect(abort).toHaveBeenCalled()
      expect(block.getAttribute('result')).toEqual([])
    })
  })
})
