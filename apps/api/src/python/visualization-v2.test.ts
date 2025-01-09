import crypto from 'crypto'
import * as services from '@jupyterlab/services'
import {
  AggregateFunction,
  ChartType,
  DataFrame,
  DataFrameColumn,
  Output,
  SeriesV2,
  TimeUnit,
  YAxisV2,
} from '@briefer/types'
import { createVisualizationV2 } from './visualizations-v2'
import { JupyterManager } from '../jupyter/manager'
import { getVar } from '../config'
import { executeCode } from './index.js'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'
import { IJupyterManager } from '../jupyter'

async function getPythonRunner(
  manager: IJupyterManager,
  workspaceId: string,
  sessionId: string
): Promise<{ dispose: () => Promise<void>; runPython: typeof executeCode }> {
  const serverSettings = await manager.getServerSettings(workspaceId)
  const kernelManager = new services.KernelManager({
    serverSettings,
  })
  const sessionManager = new services.SessionManager({
    kernelManager,
    serverSettings,
  })

  const session = await sessionManager.startNew({
    path: sessionId,
    type: 'notebook',
    name: sessionId,
    kernel: { name: 'python' },
  })

  const kernel = session.kernel
  if (!kernel) {
    session.dispose()
    throw new Error(`Got null kernel for session ${sessionId}`)
  }

  return {
    dispose: async () => {
      await kernel.shutdown()
      session.dispose()
    },
    runPython: async function runPython(
      _workspaceId: string,
      _sessionId: string,
      code: string,
      onOutputs: (outputs: Output[]) => void,
      opts: { storeHistory: boolean }
    ): ReturnType<typeof executeCode> {
      const future = kernel.requestExecute({
        code,
        allow_stdin: true,
        store_history: opts.storeHistory,
      })

      future.onIOPub = (message) => {
        switch (message.header.msg_type) {
          case 'stream':
            if ('name' in message.content) {
              onOutputs([
                {
                  type: 'stdio',
                  name: message.content.name,
                  text: message.content.text,
                },
              ])
              break
            }
          case 'error':
            if (
              'ename' in message.content &&
              'evalue' in message.content &&
              'traceback' in message.content
            ) {
              onOutputs([
                {
                  type: 'error',
                  ename: message.content.ename,
                  evalue: message.content.evalue,
                  traceback: message.content.traceback,
                },
              ])
            }
        }
      }

      return {
        abort: async () => {},
        promise: future.done.then(() => {}),
      }
    },
  }
}

describe('.createVisualizationV2', () => {
  let manager: IJupyterManager
  let pythonRunner: Awaited<ReturnType<typeof getPythonRunner>>

  beforeAll(async () => {
    manager = new JupyterManager(
      'http',
      'localhost',
      8888,
      getVar('JUPYTER_TOKEN')
    )
  })

  afterAll(async () => {
    await manager.stop()
  })

  beforeEach(async () => {
    pythonRunner = await getPythonRunner(manager, 'workspaceId', 'sessionId')
  })

  afterEach(async () => {
    await pythonRunner.dispose()
  })

  it('should return dataframe-not-found error', async () => {
    const result = await (
      await createVisualizationV2(
        'workspaceId',
        'sessionId',
        { name: 'notFound', columns: [] },
        {
          dataframeName: 'notFound',
          chartType: 'groupedColumn',
          xAxis: null,
          xAxisName: null,
          xAxisSort: 'ascending',
          xAxisGroupFunction: null,
          yAxes: [],
          filters: [],
        },
        manager,
        pythonRunner.runPython
      )
    ).promise

    expect(result).toEqual({
      success: false,
      reason: 'dataframe-not-found',
    })
  })

  const code = `import pandas as pd
df = pd.DataFrame({
  'amount': [11, 12, 13, 21, 22, 33],
  'price': [1.1, 1.2, 1.3, 2.1, 2.2, 3.3],
  'datetime': pd.to_datetime(['2021-01-01', '2021-01-02', '2021-01-03', '2021-02-01', '2021-02-02', '2021-03-03']),
  'fruit': ['apple', 'banana', 'pineapple', 'banana', 'apple', 'apple']
})`

  const fruitDFColumn: DataFrameColumn = {
    type: 'str',
    name: 'fruit',
  }

  const amountDFColumn: DataFrameColumn = {
    type: 'int',
    name: 'amount',
  }

  const priceDFColumn: DataFrameColumn = {
    type: 'float',
    name: 'price',
  }

  const datetimeDFColumn: DataFrameColumn = {
    type: 'datetime64',
    name: 'datetime',
  }

  const df: DataFrame = {
    name: 'df',
    columns: [fruitDFColumn, amountDFColumn, priceDFColumn, datetimeDFColumn],
  }

  const chartTypeOptions: ChartType[] = [
    'groupedColumn',
    'stackedColumn',
    'hundredPercentStackedColumn',
    'line',
    'area',
    'hundredPercentStackedArea',
    'scatterPlot',
    // 'pie',
    // 'histogram',
    // 'trend',
    // 'number',
  ]
  const xAxisOptions = [datetimeDFColumn, amountDFColumn]
  const xAxisSortOptions = ['ascending' as const, 'descending' as const]
  const xAxisGroupByOptions: (TimeUnit | null)[] = [
    null,
    'year',
    'quarter',
    'month',
    'week',
    'date',
    'hours',
    'minutes',
    'seconds',
  ]
  const yAxisOptions = [
    {
      left: [amountDFColumn],
      right: [],
    },
    {
      left: [amountDFColumn, priceDFColumn],
      right: [],
    },
    {
      left: [amountDFColumn],
      right: [priceDFColumn],
    },
  ]
  const yAxisAggregateFunctionOptions: (AggregateFunction | null)[] = [
    null,
    'sum',
    'mean',
    'median',
    'count',
    'min',
    'max',
  ]
  const yAxisGroupByOptions = [null, fruitDFColumn]

  let i = 0
  for (const chartType of chartTypeOptions) {
    for (const xAxis of xAxisOptions) {
      for (const xAxisSort of xAxisSortOptions) {
        for (const xAxisGroupBy of xAxisGroupByOptions) {
          for (const yAxisAggregateFunction of yAxisAggregateFunctionOptions) {
            for (const yAxisGroupBy of yAxisGroupByOptions) {
              for (const yAxis of yAxisOptions) {
                const yAxes: YAxisV2[] = []
                const leftAxisSeries: SeriesV2[] = []
                for (const left of yAxis.left) {
                  leftAxisSeries.push({
                    axisName: null,
                    chartType: null,
                    column: left,
                    aggregateFunction: yAxisAggregateFunction,
                    groupBy: yAxisGroupBy,
                  })
                }
                if (leftAxisSeries.length > 0) {
                  yAxes.push({ series: leftAxisSeries })
                }

                const rightAxisSeries: SeriesV2[] = []
                for (const right of yAxis.right) {
                  rightAxisSeries.push({
                    axisName: null,
                    chartType: null,
                    column: right,
                    aggregateFunction: yAxisAggregateFunction,
                    groupBy: yAxisGroupBy,
                  })
                }
                if (rightAxisSeries.length > 0) {
                  yAxes.push({ series: rightAxisSeries })
                }

                const input: VisualizationV2BlockInput = {
                  dataframeName: 'df',
                  chartType,
                  xAxis,
                  xAxisName: null,
                  xAxisSort,
                  xAxisGroupFunction: xAxisGroupBy,
                  yAxes,
                  filters: [],
                }

                // only datetime can be grouped by in x-axis
                if (xAxis.name !== 'datetime' && xAxisGroupBy) {
                  continue
                }

                const checksum = crypto
                  .createHash('sha256')
                  .update(JSON.stringify(input))
                  .digest('hex')
                it(`${checksum}`, async () => {
                  await (
                    await pythonRunner.runPython(
                      checksum,
                      checksum,
                      code,
                      () => {},
                      {
                        storeHistory: true,
                      }
                    )
                  ).promise

                  const result = await (
                    await createVisualizationV2(
                      'workspaceId',
                      checksum,
                      df,
                      input,
                      manager,
                      pythonRunner.runPython
                    )
                  ).promise

                  expect(result.success).toBe(true)

                  // this makes jest write input to snapshot which is usefull
                  // for debugging when the test fails
                  expect(input).toMatchSnapshot()

                  expect(result).toMatchSnapshot()
                })
              }
            }
          }
        }
      }
    }
  }
})
