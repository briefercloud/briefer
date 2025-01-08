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
              console.log(message.content.text)
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
  'integers': [1, 2, 3],
  'datetimes': pd.to_datetime(['2021-01-01', '2021-01-02', '2021-01-03']),
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
        xAxis: [
          {
            data: [1, 2, 3],
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
            data: [1, 2, 3],
            type: 'bar',
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
        expect(result.output.result).toEqual(result)
      }
    })
  }

  afterAll(async () => {
    await manager.stop()
  })
})
