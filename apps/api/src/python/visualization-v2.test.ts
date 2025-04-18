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
      sessionManager.dispose()
      kernelManager.dispose()
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
          xAxisDateFormat: null,
          xAxisNumberFormat: null,
          yAxes: [],
          histogramFormat: 'count',
          histogramBin: { type: 'auto' },
          filters: [],
          dataLabels: {
            show: false,
            frequency: 'all',
          },
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
  'fruit': ['apple', 'banana', 'pineapple', 'banana', 'apple', 'apple'],
  'is_apple': [True, False, False, False, True, True]
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

  const isAppleDFColumn: DataFrameColumn = {
    type: 'bool',
    name: 'is_apple',
  }

  const df: DataFrame = {
    name: 'df',
    columns: [
      fruitDFColumn,
      amountDFColumn,
      priceDFColumn,
      datetimeDFColumn,
      isAppleDFColumn,
    ],
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
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [
        {
          id: 'yAxis-1',
          name: null,
          series: [
            {
              id: 'series-1',
              chartType: null,
              column: amountDFColumn,
              aggregateFunction: 'sum',
              groupBy: fruitDFColumn,
              name: null,
              color: null,
              groups: null,
              dateFormat: null,
              numberFormat: null,
            },
          ],
        },
      ],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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

    const janTotal = 11 + 12 + 13
    const febTotal = 21 + 22
    const marTotal = 33

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      filters: [],
      data: {
        tooltip: {
          trigger: 'axis',
        },
        legend: {},
        grid: {
          containLabel: true,
        },
        dataset: [
          {
            dimensions: ['datetime', 'series-1'],
            source: [
              {
                'series-1': 11 / janTotal,
                datetime: '2021-01-01 00:00:00',
              },
              {
                'series-1': 22 / febTotal,
                datetime: '2021-02-01 00:00:00',
              },
              {
                'series-1': 33 / marTotal,
                datetime: '2021-03-01 00:00:00',
              },
            ],
          },
          {
            dimensions: ['datetime', 'series-1'],
            source: [
              {
                'series-1': 12 / janTotal,
                datetime: '2021-01-01 00:00:00',
              },
              {
                'series-1': 21 / febTotal,
                datetime: '2021-02-01 00:00:00',
              },
              {
                'series-1': 0,
                datetime: '2021-03-01 00:00:00',
              },
            ],
          },
          {
            dimensions: ['datetime', 'series-1'],
            source: [
              {
                'series-1': 13 / janTotal,
                datetime: '2021-01-01 00:00:00',
              },
              {
                'series-1': 0,
                datetime: '2021-02-01 00:00:00',
              },
              {
                'series-1': 0,
                datetime: '2021-03-01 00:00:00',
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'time',
            axisPointer: {
              type: 'shadow',
            },
            name: null,
            nameLocation: 'middle',
            max: 'dataMax',
            min: 'dataMin',
          },
        ],
        yAxis: [
          {
            type: 'value',
            position: 'left',
            name: null,
            nameLocation: 'middle',
          },
        ],
        series: [
          {
            id: 'series-1:apple',
            datasetIndex: 0,
            yAxisIndex: 0,
            name: 'apple',
            z: 0,
            type: 'bar',
            stack: 'stack-0-0',
            color: '#5470c6',
            encode: {
              x: 'datetime',
              y: 'series-1',
            },
          },
          {
            id: 'series-1:banana',
            datasetIndex: 1,
            yAxisIndex: 0,
            name: 'banana',
            z: 0,
            type: 'bar',
            stack: 'stack-0-0',
            color: '#91cc75',
            encode: {
              x: 'datetime',
              y: 'series-1',
            },
          },
          {
            id: 'series-1:pineapple',
            datasetIndex: 2,
            yAxisIndex: 0,
            name: 'pineapple',
            z: 0,
            type: 'bar',
            stack: 'stack-0-0',
            color: '#fac858',
            encode: {
              x: 'datetime',
              y: 'series-1',
            },
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
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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
      filters: [],
      data: {
        tooltip: {
          trigger: 'axis',
        },
        legend: {},
        grid: {
          containLabel: true,
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
            name: null,
            nameLocation: 'middle',
          },
        ],
        yAxis: [
          {
            type: 'value',
            position: 'left',
            name: null,
            nameLocation: 'middle',
          },
        ],
        series: [
          {
            datasetIndex: 0,
            yAxisIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
            color: '#5470c6',
            id: 'y-0-series-0',
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
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'stepSize', value: 5 },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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
      filters: [],
      data: {
        tooltip: {
          trigger: 'axis',
        },
        legend: {},
        grid: {
          containLabel: true,
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
            name: null,
            nameLocation: 'middle',
          },
        ],
        yAxis: [
          {
            type: 'value',
            position: 'left',
            name: null,
            nameLocation: 'middle',
          },
        ],
        series: [
          {
            id: 'y-0-series-0',
            datasetIndex: 0,
            yAxisIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
            color: '#5470c6',
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
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [],
      histogramFormat: 'count',
      histogramBin: { type: 'maxBins', value: 2 },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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
      filters: [],
      data: {
        tooltip: {
          trigger: 'axis',
        },
        legend: {},
        grid: {
          containLabel: true,
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
            name: null,
            nameLocation: 'middle',
          },
        ],
        yAxis: [
          {
            type: 'value',
            position: 'left',
            name: null,
            nameLocation: 'middle',
          },
        ],
        series: [
          {
            id: 'y-0-series-0',
            datasetIndex: 0,
            yAxisIndex: 0,
            z: 0,
            type: 'bar',
            barWidth: '99.5%',
            color: '#5470c6',
          },
        ],
      },
    })
  })

  it('should work properly when group by is on a boolean column', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'groupedColumn',
      xAxis: datetimeDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [
        {
          id: 'yAxis-1',
          name: null,
          series: [
            {
              id: 'series-1',
              chartType: null,
              column: amountDFColumn,
              aggregateFunction: 'sum',
              groupBy: isAppleDFColumn,
              name: null,
              color: null,
              groups: null,
              dateFormat: null,
              numberFormat: null,
            },
          ],
        },
      ],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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

    const janAppleTotal = 11
    const janNotAppleTotal = 12 + 13
    const febAppleTotal = 22
    const febNotAppleTotal = 21
    const marAppleTotal = 33

    expect(result).toEqual({
      success: true,
      tooManyDataPoints: false,
      filters: [],
      data: {
        tooltip: {
          trigger: 'axis',
        },
        legend: {},
        grid: {
          containLabel: true,
        },
        dataset: [
          {
            dimensions: ['datetime', 'series-1'],
            source: [
              {
                'series-1': janNotAppleTotal,
                datetime: '2021-01-01 00:00:00',
              },
              {
                'series-1': febNotAppleTotal,
                datetime: '2021-02-01 00:00:00',
              },
              {
                'series-1': 0,
                datetime: '2021-03-01 00:00:00',
              },
            ],
          },
          {
            dimensions: ['datetime', 'series-1'],
            source: [
              {
                'series-1': janAppleTotal,
                datetime: '2021-01-01 00:00:00',
              },
              {
                'series-1': febAppleTotal,
                datetime: '2021-02-01 00:00:00',
              },
              {
                'series-1': marAppleTotal,
                datetime: '2021-03-01 00:00:00',
              },
            ],
          },
        ],
        xAxis: [
          {
            type: 'time',
            axisPointer: {
              type: 'shadow',
            },
            name: null,
            nameLocation: 'middle',
            max: 'dataMax',
            min: 'dataMin',
          },
        ],
        yAxis: [
          {
            type: 'value',
            position: 'left',
            name: null,
            nameLocation: 'middle',
          },
        ],
        series: [
          {
            id: 'series-1:False',
            datasetIndex: 0,
            yAxisIndex: 0,
            name: 'False',
            z: 0,
            type: 'bar',
            color: '#5470c6',
            encode: {
              x: 'datetime',
              y: 'series-1',
            },
          },
          {
            id: 'series-1:True',
            datasetIndex: 1,
            yAxisIndex: 0,
            name: 'True',
            z: 0,
            type: 'bar',
            color: '#91cc75',
            encode: {
              x: 'datetime',
              y: 'series-1',
            },
          },
        ],
      },
    })
  })

  it('should fill missing values of a group for particular x-axis with 0', async () => {
    await (
      await pythonRunner.runPython('workspaceId', 'sessionId', code, () => {}, {
        storeHistory: true,
      })
    ).promise

    const input: VisualizationV2BlockInput = {
      dataframeName: 'df',
      chartType: 'stackedColumn',
      xAxis: datetimeDFColumn,
      xAxisName: null,
      xAxisSort: 'ascending',
      xAxisGroupFunction: 'month',
      xAxisDateFormat: null,
      xAxisNumberFormat: null,
      yAxes: [
        {
          id: 'yAxis-1',
          name: null,
          series: [
            {
              id: 'series-1',
              chartType: null,
              column: amountDFColumn,
              aggregateFunction: 'sum',
              groupBy: fruitDFColumn,
              name: null,
              color: null,
              groups: null,
              dateFormat: null,
              numberFormat: null,
            },
          ],
        },
      ],
      histogramFormat: 'count',
      histogramBin: { type: 'auto' },
      filters: [],
      dataLabels: {
        show: false,
        frequency: 'all',
      },
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

    const janAppleTotal = 11
    const janBananaTotal = 12
    const janPineappleTotal = 13
    const febAppleTotal = 22
    const febBananaTotal = 21
    const febPineappleTotal = 0
    const marAppleTotal = 33
    const marBananaTotal = 0
    const marPineappleTotal = 0

    expect(result.success).toBe(true)
    if (!result.success) {
      return
    }

    expect(result.data.dataset).toEqual([
      {
        dimensions: ['datetime', 'series-1'],
        source: [
          {
            'series-1': janAppleTotal,
            datetime: '2021-01-01 00:00:00',
          },
          {
            'series-1': febAppleTotal,
            datetime: '2021-02-01 00:00:00',
          },
          {
            'series-1': marAppleTotal,
            datetime: '2021-03-01 00:00:00',
          },
        ],
      },
      {
        dimensions: ['datetime', 'series-1'],
        source: [
          {
            'series-1': janBananaTotal,
            datetime: '2021-01-01 00:00:00',
          },
          {
            'series-1': febBananaTotal,
            datetime: '2021-02-01 00:00:00',
          },
          {
            'series-1': marBananaTotal,
            datetime: '2021-03-01 00:00:00',
          },
        ],
      },
      {
        dimensions: ['datetime', 'series-1'],
        source: [
          {
            'series-1': janPineappleTotal,
            datetime: '2021-01-01 00:00:00',
          },
          {
            'series-1': febPineappleTotal,
            datetime: '2021-02-01 00:00:00',
          },
          {
            'series-1': marPineappleTotal,
            datetime: '2021-03-01 00:00:00',
          },
        ],
      },
    ])
  })
})
