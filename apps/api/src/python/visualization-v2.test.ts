import * as services from '@jupyterlab/services'
import { DataFrame, DataFrameColumn, Output } from '@briefer/types'
import { createVisualizationV2 } from './visualizations-v2'
import { JupyterManager } from '../jupyter/manager'
import { getVar } from '../config'
import { executeCode } from './index.js'
import { VisualizationV2BlockInput } from '@briefer/editor'
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
          histogramFormat: 'count',
          histogramBin: { type: 'auto' },
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

  it('it should compute normalized values for hundredPercentStackedColumn', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'hundredPercentStackedColumn',
      xAxis: datetimeDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      yAxes: [
        {
          series: [
            {
              axisName: null,
              chartType: null,
              column: amountDFColumn,
              aggregateFunction: null,
              groupBy: fruitDFColumn,
            },
          ],
        },
      ],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
    }

    const result = await (
      await createVisualizationV2(
        'workspaceId',
        'sessionId',
        df,
        input,
        manager,
        pythonRunner.runPython
      )
    ).promise

    console.log(JSON.stringify(result, null, 2))

    const janTotal = 11 + 12 + 13
    const febTotal = 21 + 22
    const marTotal = 33

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      data: {
        tooltip: {
          trigger: 'axis',
        },
        dataset: [
          {
            dimensions: ['datetime', 'amount'],
            source: [
              {
                amount: 11 / janTotal,
                datetime: '2021-01-01T00:00:00',
              },
              {
                amount: 22 / febTotal,
                datetime: '2021-02-01T00:00:00',
              },
              {
                amount: 33 / marTotal,
                datetime: '2021-03-01T00:00:00',
              },
            ],
          },
          {
            dimensions: ['datetime', 'amount'],
            source: [
              {
                amount: 12 / janTotal,
                datetime: '2021-01-01T00:00:00',
              },
              {
                amount: 21 / febTotal,
                datetime: '2021-02-01T00:00:00',
              },
            ],
          },
          {
            dimensions: ['datetime', 'amount'],
            source: [
              {
                amount: 13 / janTotal,
                datetime: '2021-01-01T00:00:00',
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
            axisPointer: {
              type: 'shadow',
            },
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            datasetIndex: 0,
            name: 'apple',
            z: 0,
            type: 'bar',
            stack: 'stack_0',
          },
          {
            datasetIndex: 1,
            name: 'banana',
            z: 0,
            type: 'bar',
            stack: 'stack_0',
          },
          {
            datasetIndex: 2,
            name: 'pineapple',
            z: 0,
            type: 'bar',
            stack: 'stack_0',
          },
        ],
      },
    })
  })

  it('it should produce auto histograms', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'histogram',
      xAxis: amountDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
    }

    const result = await (
      await createVisualizationV2(
        'workspaceId',
        'sessionId',
        df,
        input,
        manager,
        pythonRunner.runPython
      )
    ).promise

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      data: {
        tooltip: {
          trigger: 'axis',
        },
        dataset: [
          {
            dimensions: ['bin', 'value'],
            source: [
              {
                bin: 0,
                value: 0,
              },
              {
                bin: 5.5,
                value: 0,
              },
              {
                bin: 11,
                value: 3,
              },
              {
                bin: 16.5,
                value: 1,
              },
              { bin: 22, value: 1 },
              {
                bin: 27.5,
                value: 1,
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
            axisPointer: {
              type: 'shadow',
            },
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            datasetIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
          },
        ],
      },
    })
  })

  it('it should produce stepSize histograms', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'histogram',
      xAxis: amountDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'stepSize', value: 5 },
      filters: [],
    }

    const result = await (
      await createVisualizationV2(
        'workspaceId',
        'sessionId',
        df,
        input,
        manager,
        pythonRunner.runPython
      )
    ).promise

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      data: {
        tooltip: {
          trigger: 'axis',
        },
        dataset: [
          {
            dimensions: ['bin', 'value'],
            source: [
              {
                bin: '0',
                value: 0,
              },
              {
                bin: '5',
                value: 0,
              },
              {
                bin: '10',
                value: 3,
              },
              {
                bin: '15',
                value: 0,
              },
              { bin: '20', value: 2 },
              {
                bin: '25',
                value: 0,
              },
              {
                bin: '30',
                value: 1,
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
            axisPointer: {
              type: 'shadow',
            },
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            datasetIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
          },
        ],
      },
    })
  })

  it('it should produce maxBins histograms', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'histogram',
      xAxis: amountDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'maxBins', value: 2 },
      filters: [],
    }

    const result = await (
      await createVisualizationV2(
        'workspaceId',
        'sessionId',
        df,
        input,
        manager,
        pythonRunner.runPython
      )
    ).promise

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      data: {
        tooltip: {
          trigger: 'axis',
        },
        dataset: [
          {
            dimensions: ['bin', 'value'],
            source: [
              {
                bin: 0,
                value: 3,
              },
              {
                bin: 16.5,
                value: 3,
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
            axisPointer: {
              type: 'shadow',
            },
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            datasetIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
          },
        ],
      },
    })
  })
})
