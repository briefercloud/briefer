import {
  Output,
  DataFrame,
  exhaustiveCheck,
  PythonErrorOutput,
  jsonString,
} from '@briefer/types'
import { executeCode, PythonExecutionError } from './index.js'
import { IJupyterManager } from '../jupyter/index.js'
import {
  VisualizationV2BlockInput,
  VisualizationV2BlockOutput,
} from '@briefer/editor'
import AggregateError from 'aggregate-error'
import { z } from 'zod'

function getCode(dataframe: DataFrame, input: VisualizationV2BlockInput) {
  const strInput = JSON.stringify(input)
  let code = `import json
from datetime import datetime

def _briefer_create_visualization(df, options):
  x_axis = [{
    "type": "category",
    "data": df[options["xAxis"]["name"]].tolist()
  }]
  y_axis = []
  batata = []

  for y_axis_options in options["yAxes"]:
      y_axis.append({
        "type": "value",
      })
      for series_options in y_axis_options["series"]:
          batata.append({
              "type": "bar",
              "data": df[series_options["column"]["name"]].tolist()
          })
      
  print(json.dumps({
      "success": True,
      "output": {
          "executedAt": datetime.now().isoformat(),
          "result":{
              "xAxis": x_axis,
              "yAxis": y_axis,
              "series": batata
          }
      }
  }))


if "${dataframe.name}" in globals():
    df = ${dataframe.name}.copy()
    options = json.loads(${JSON.stringify(strInput)})
    _briefer_create_visualization(df, options)
else:
    print(json.dumps({"success": False, "reason": "dataframe-not-found"}))`

  return code
}

const CreateVisualizationResult = z.union([
  z.object({
    success: z.literal(true),
    output: VisualizationV2BlockOutput,
  }),
  z.object({
    success: z.literal(false),
    reason: z.union([
      z.literal('dataframe-not-found'),
      z.literal('aborted'),
      z.literal('invalid-params'),
    ]),
  }),
])
type CreateVisualizationResult = z.infer<typeof CreateVisualizationResult>

export type CreateVisualizationTask = {
  promise: Promise<CreateVisualizationResult>
  abort: () => Promise<void>
}

export async function createVisualizationV2(
  workspaceId: string,
  sessionId: string,
  dataframe: DataFrame,
  input: VisualizationV2BlockInput,
  jupyterManager: IJupyterManager,
  executePython: typeof executeCode
): Promise<CreateVisualizationTask> {
  await jupyterManager.ensureRunning(workspaceId)

  const code = getCode(dataframe, input)

  let outputs: Output[] = []
  const { promise: execute, abort } = await executePython(
    workspaceId,
    sessionId,
    code,
    (newOutputs) => {
      outputs = outputs.concat(newOutputs)
    },
    { storeHistory: false }
  )

  const promise = execute.then((): CreateVisualizationResult => {
    let result: CreateVisualizationResult | null = null
    const pythonErrors: PythonErrorOutput[] = []
    const outputParsingErrors: Error[] = []
    for (const output of outputs) {
      switch (output.type) {
        case 'html':
          break
        case 'error':
          pythonErrors.push(output)
          break
        case 'stdio':
          switch (output.name) {
            case 'stdout':
              for (const line of output.text.split('\n')) {
                if (!result?.success) {
                  try {
                    console.log(line)
                    console.log(line)
                    console.log(JSON.parse(line))
                  } catch (e) {
                    console.log(e)
                  }

                  const parsed = jsonString
                    .pipe(CreateVisualizationResult)
                    .safeParse(line.trim())
                  if (parsed.success) {
                    result = parsed.data
                  } else {
                    outputParsingErrors.push(parsed.error)
                  }
                }
              }
              break
            case 'stderr':
              console.error(output.text)
              break
            default:
              exhaustiveCheck(output.name)
          }
          break
        case 'image':
          break
        case 'plotly':
          break
        default:
          exhaustiveCheck(output)
      }
    }

    if (
      (pythonErrors.length > 0 || outputParsingErrors.length > 0) &&
      result === null
    ) {
      throw new AggregateError([
        ...pythonErrors.map(
          (err) =>
            new PythonExecutionError(
              err.type,
              err.ename,
              err.evalue,
              err.traceback
            )
        ),
        ...outputParsingErrors,
      ])
    }

    if (result === null) {
      throw new Error('Got no output back from running createVisualizationV2')
    }

    return result
  })

  return {
    promise,
    abort,
  }
}
