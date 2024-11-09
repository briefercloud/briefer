import * as Y from 'yjs'
import PQueue from 'p-queue'
import { VisualizationEffects, VisualizationExecutor } from './visualization.js'
import {
  YBlock,
  VisualizationBlock,
  makeVisualizationBlock,
} from '@briefer/editor'
import { DataFrame } from '@briefer/types'
import { VisEvents } from '../../../../events/index.js'

describe('VisualizationExecutor', () => {
  let ydoc: Y.Doc
  let block: Y.XmlElement<VisualizationBlock>
  let blocksExecutor: VisualizationExecutor
  let effects: jest.Mocked<VisualizationEffects>
  let events: jest.Mocked<VisEvents>
  let dataframes: Y.Map<DataFrame>
  let dataframe: DataFrame
  let queue: PQueue

  beforeEach(() => {
    ydoc = new Y.Doc()
    dataframes = ydoc.getMap<DataFrame>('dataframes')
    const blocks = ydoc.getMap<YBlock>('blocks')
    block = makeVisualizationBlock('blockId')
    blocks.set('blockId', block)
    effects = {
      createVisualization: jest.fn(),
    }
    events = {
      visUpdate: jest.fn(),
    }
    queue = new PQueue({ concurrency: 1 })
    blocksExecutor = new VisualizationExecutor(
      'workspaceId',
      'documentId',
      dataframes,
      queue,
      effects,
      events
    )

    block.setAttribute('dataframeName', 'df')
    block.setAttribute('chartType', 'groupedColumn')
    block.setAttribute('xAxis', { name: 'a', type: 'string' })
    block.setAttribute('yAxes', [
      {
        series: [
          {
            axisName: null,
            chartType: null,
            column: { name: 'b', type: 'int' },
            aggregateFunction: null,
            colorBy: null,
          },
        ],
      },
    ])
    dataframe = {
      name: 'df',
      columns: [
        { name: 'a', type: 'string' },
        { name: 'b', type: 'int' },
      ],
    }
    dataframes.set('df', dataframe)
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
    it('should create the visualization by performing the createVisualization effect', async () => {
      const prevUpdatedAt = new Date(Date.now() - 1000 * 60).toISOString()
      block.setAttribute('updatedAt', prevUpdatedAt)
      // block.setAttribute('status', 'running')
      const spec = {
        a: 'cool',
        chart: '=]',
      }
      effects.createVisualization.mockResolvedValue({
        promise: Promise.resolve({
          success: true,
          spec,
          filterResults: {},
        }),
        abort: jest.fn(),
      })
      await blocksExecutor.run(block, new Y.Transaction(ydoc, {}, true))

      expect(effects.createVisualization).toHaveBeenCalledWith(
        'workspaceId',
        'documentId',
        dataframe,
        'groupedColumn',
        { name: 'a', type: 'string' },
        null,
        null,
        'ascending',
        [
          {
            series: [
              {
                axisName: null,
                aggregateFunction: null,
                chartType: null,
                colorBy: null,
                column: { name: 'b', type: 'int' },
              },
            ],
          },
        ],
        'count',
        { type: 'auto' },
        false,
        null,
        []
      )
      expect(block.getAttribute('spec')).toEqual(spec)
      expect(block.getAttribute('error')).toEqual(null)
      expect(
        new Date(block.getAttribute('updatedAt')!).getTime()
      ).toBeGreaterThan(new Date(prevUpdatedAt).getTime())
    })

    it('should set error when createVisualization fails with dataframe-not-found', async () => {
      // block.setAttribute('status', 'running')
      effects.createVisualization.mockResolvedValue({
        promise: Promise.resolve({
          success: false,
          reason: 'dataframe-not-found',
          filterResults: {},
        }),
        abort: jest.fn(),
      })
      await blocksExecutor.run(block, new Y.Transaction(ydoc, {}, true))

      expect(block.getAttribute('error')).toEqual('dataframe-not-found')
    })

    it('should do nothing when createVisualization fails with aborted', async () => {
      // block.setAttribute('status', 'running')

      const prevAttributes = block.getAttributes()
      effects.createVisualization.mockResolvedValue({
        promise: Promise.resolve({
          success: false,
          reason: 'aborted',
          filterResults: {},
        }),
        abort: jest.fn(),
      })
      await blocksExecutor.run(block, new Y.Transaction(ydoc, {}, true))

      expect(block.getAttributes()).toEqual(prevAttributes)
    })
  })
})
