import * as services from '@jupyterlab/services'
import { DataFrame, DataFrameColumn, Output } from '@briefer/types'
import { createVisualizationV2 } from './visualizations-v2'
import { JupyterManager } from '../jupyter/manager'
import { getVar } from '../config'
import { executeCode } from './index.js'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'

const manager = new JupyterManager(
  'http',
  'localhost',
  8888,
  getVar('JUPYTER_TOKEN')
)

async function getPythonRunner(
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
  let pythonRunner: Awaited<ReturnType<typeof getPythonRunner>>

  beforeEach(async () => {
    pythonRunner = await getPythonRunner('workspaceId', 'sessionId')
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
  'integers': [11, 12, 13, 21, 22, 33],
  'datetimes': pd.to_datetime(['2021-01-01', '2021-01-02', '2021-01-03', '2021-02-01', '2021-03-02', '2021-03-03']),
})`

  const integersDFColumn: DataFrameColumn = {
    type: 'int',
    name: 'integers',
  }

  const datetimesDFColumn: DataFrameColumn = {
    type: 'datetime64',
    name: 'datetimes',
  }

  const df: DataFrame = {
    name: 'df',
    columns: [integersDFColumn, datetimesDFColumn],
  }

  const cases: {
    name: string
    input: VisualizationV2BlockInput
    result: VisualizationV2BlockOutputResult
  }[] = [
    {
      name: 'datetime by integer groupedColumn',
      input: {
        dataframeName: 'df',
        chartType: 'groupedColumn',
        xAxis: datetimesDFColumn,
        xAxisName: null,
        xAxisSort: 'ascending',
        xAxisGroupFunction: null,
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
              { datetimes: '2021-01-02T00:00:00', integers: 12 },
              { datetimes: '2021-01-03T00:00:00', integers: 13 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-03-02T00:00:00', integers: 22 },
              { datetimes: '2021-03-03T00:00:00', integers: 33 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'bar',
            datasetIndex: 0,
          },
        ],
      },
    },
    {
      name: 'integer by integer groupedColumn',
      input: {
        dataframeName: 'df',
        chartType: 'groupedColumn',
        xAxis: integersDFColumn,
        xAxisName: null,
        xAxisSort: 'ascending',
        xAxisGroupFunction: null,
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['integers', 'integers'],
            source: [
              { integers: 11 },
              { integers: 12 },
              { integers: 13 },
              { integers: 21 },
              { integers: 22 },
              { integers: 33 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'bar',
            datasetIndex: 0,
          },
        ],
      },
    },
    {
      name: 'datetime by integer group by month',
      input: {
        dataframeName: 'df',
        chartType: 'groupedColumn',
        xAxis: datetimesDFColumn,
        xAxisName: null,
        xAxisSort: 'ascending',
        xAxisGroupFunction: 'month',
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
              { datetimes: '2021-01-01T00:00:00', integers: 12 },
              { datetimes: '2021-01-01T00:00:00', integers: 13 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-03-01T00:00:00', integers: 22 },
              { datetimes: '2021-03-01T00:00:00', integers: 33 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'bar',
            datasetIndex: 0,
          },
        ],
      },
    },
    {
      name: 'datetime desc by integer groupedColumn',
      input: {
        dataframeName: 'df',
        chartType: 'groupedColumn',
        xAxis: datetimesDFColumn,
        xAxisName: null,
        xAxisSort: 'descending',
        xAxisGroupFunction: null,
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-03-03T00:00:00', integers: 33 },
              { datetimes: '2021-03-02T00:00:00', integers: 22 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-01-03T00:00:00', integers: 13 },
              { datetimes: '2021-01-02T00:00:00', integers: 12 },
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'bar',
            datasetIndex: 0,
          },
        ],
      },
    },
    {
      name: 'datetime by integer area',
      input: {
        dataframeName: 'df',
        chartType: 'area',
        xAxis: datetimesDFColumn,
        xAxisName: null,
        xAxisSort: 'descending',
        xAxisGroupFunction: null,
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-03-03T00:00:00', integers: 33 },
              { datetimes: '2021-03-02T00:00:00', integers: 22 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-01-03T00:00:00', integers: 13 },
              { datetimes: '2021-01-02T00:00:00', integers: 12 },
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'line',
            areaStyle: {},
            datasetIndex: 0,
          },
        ],
      },
    },
    {
      name: 'datetime by integer multi series',
      input: {
        dataframeName: 'df',
        chartType: 'groupedColumn',
        xAxis: datetimesDFColumn,
        xAxisName: null,
        xAxisSort: 'ascending',
        xAxisGroupFunction: null,
        yAxes: [
          {
            series: [
              {
                axisName: null,
                chartType: null,
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
              {
                axisName: null,
                chartType: 'line',
                column: integersDFColumn,
                aggregateFunction: null,
                colorBy: null,
              },
            ],
          },
        ],
      },
      result: {
        dataset: [
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
              { datetimes: '2021-01-02T00:00:00', integers: 12 },
              { datetimes: '2021-01-03T00:00:00', integers: 13 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-03-02T00:00:00', integers: 22 },
              { datetimes: '2021-03-03T00:00:00', integers: 33 },
            ],
          },
          {
            dimensions: ['datetimes', 'integers'],
            source: [
              { datetimes: '2021-01-01T00:00:00', integers: 11 },
              { datetimes: '2021-01-02T00:00:00', integers: 12 },
              { datetimes: '2021-01-03T00:00:00', integers: 13 },
              { datetimes: '2021-02-01T00:00:00', integers: 21 },
              { datetimes: '2021-03-02T00:00:00', integers: 22 },
              { datetimes: '2021-03-03T00:00:00', integers: 33 },
            ],
          },
        ],
        xAxis: [
          {
            type: 'category',
          },
        ],
        yAxis: [
          {
            type: 'value',
          },
        ],
        series: [
          {
            type: 'bar',
            datasetIndex: 0,
          },
          {
            type: 'line',
            datasetIndex: 1,
          },
        ],
      },
    },
  ]

  for (const test of cases) {
    it(test.name, async () => {
      await (
        await pythonRunner.runPython(
          'workspaceId',
          'sessionId',
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
          'sessionId',
          df,
          test.input,
          manager,
          pythonRunner.runPython
        )
      ).promise

      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual(test.result)
      }
    })
  }

  afterAll(async () => {
    await manager.stop()
  })
})
