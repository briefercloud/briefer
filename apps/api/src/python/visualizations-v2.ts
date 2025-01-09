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
  VisualizationV2BlockOutputResult,
} from '@briefer/editor'
import AggregateError from 'aggregate-error'
import { z } from 'zod'
import { logger } from '../logger.js'

function getCode(dataframe: DataFrame, input: VisualizationV2BlockInput) {
  const strInput = JSON.stringify(input)
  let code = `import json
from datetime import datetime

def _briefer_create_visualization(df, options):
    def extract_chart_type(chartType):
        if chartType == "groupedColumn":
            return "bar", False
        elif chartType == "stackedColumn":
            return "bar", False
        elif chartType == "hundredPercentStackedColumn":
            return "bar", False
        elif chartType == "line":
            return "line", False
        elif chartType == "area":
            return "line", True
        elif chartType == "hundredPercentStackedArea":
            return "line", True
        elif chartType == "scatterPlot":
            return "scatter", False
        elif chartType == "pie":
            raise ValueError("Pie chart is not implemented yet")
        elif chartType == "histogram":
            raise ValueError("Histogram chart is not supported")
        elif chartType == "trend":
            raise ValueError("Trend chart is not supported")
        elif chartType == "number":
            raise ValueError("Number chart is not supported")

    def convert_value(column, value):
        if pd.api.types.is_numeric_dtype(column):
            return pd.to_numeric(value, errors='coerce')

        if pd.api.types.is_datetime64_any_dtype(column):
            return value.isoformat()

        return value

    def group_dataframe(df, options):
        if options["xAxisGroupFunction"]:
            freq = {
                'year': 'Y',
                'quarter': 'Q',
                'month': 'M',
                'week': 'W',
                'date': 'D',
                'hours': 'h',
                'minutes': 'min',
                'seconds': 's'
            }.get(options["xAxisGroupFunction"], None)

            if freq:
                df[options["xAxis"]["name"]] = pd.to_datetime(df[options["xAxis"]["name"]])
                # Group by the specified frequency but keep all rows
                df["_grouped"] = df[options["xAxis"]["name"]].dt.to_period(freq).dt.start_time
                return df

        return df

    def sort_dataframe(df, options):
        if options["xAxisSort"]:
            return df.sort_values(
                by=options["xAxis"]["name"],
                ascending=options["xAxisSort"] == "ascending"
            )

        return df

    def prepare_chart_df(df, options):
        # Prepare data by grouping
        result = group_dataframe(df.copy(), options)
        if "_grouped" in result:
            result[options["xAxis"]["name"]] = result["_grouped"]
            result = result.drop(columns=["_grouped"])

        result = sort_dataframe(result, options)

        return result


    chart_df = prepare_chart_df(df, options)


    data = {
        "dataset": {
            "dimensions": [options["xAxis"]["name"]],
            "source": [],
        },
        "xAxis": [{
          "type": "category",
        }],
        "yAxis": [],
        "series": [],
    }


    defaultType, _ = extract_chart_type(options["chartType"])
    for y_axis in options["yAxes"]:
        for series in y_axis["series"]:
            chart_type, is_area = extract_chart_type(series["chartType"] or options["chartType"])
            data["dataset"]["dimensions"].append(series["column"]["name"])
            data["yAxis"].append({
                "type": "value",
            })
            serie = {
              "type": chart_type
            }
            if is_area:
                serie["areaStyle"] = {}

            data["series"].append(serie)

    index = 0
    for _, row in chart_df.iterrows():
        x_name = options["xAxis"]["name"]
        x_value = convert_value(chart_df[x_name], row[x_name])

        data["dataset"]["source"].append({
            x_name: x_value,
        })
        for y_axis in options["yAxes"]:
            for series in y_axis["series"]:
                y_name = series["column"]["name"]
                y_value = convert_value(chart_df[y_name], row[y_name])

                data["dataset"]["source"][index][y_name] = y_value
        index += 1


    output = json.dumps({
        "type": "result",
        "data": {
            "success": True,
            "data": data
        }
    }, default=str)

    print(output)


if "${dataframe.name}" in globals():
    df = ${dataframe.name}.copy()
    options = json.loads(${JSON.stringify(strInput)})
    _briefer_create_visualization(df, options)
else:
    output = json.dumps({
        "type":"result",
        "data": {
            "success": False,
            "reason": "dataframe-not-found"
        }
    }, default=str)
    print(output)`

  console.log(code)

  return code
}

const CreateVisualizationResult = z.union([
  z.object({
    success: z.literal(true),
    data: VisualizationV2BlockOutputResult,
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
              for (const l of output.text.split('\n')) {
                const line = l.trim()
                if (line === '') {
                  continue
                }

                if (!result?.success) {
                  const parsed = jsonString
                    .pipe(
                      z.union([
                        z.object({
                          type: z.literal('log'),
                          message: z.string(),
                        }),
                        z.object({
                          type: z.literal('result'),
                          data: CreateVisualizationResult,
                        }),
                      ])
                    )
                    .safeParse(line.trim())
                  if (parsed.success) {
                    switch (parsed.data.type) {
                      case 'log':
                        console.log(
                          JSON.stringify(
                            {
                              workspaceId,
                              sessionId,
                              message: parsed.data.message,
                              input,
                            },
                            null,
                            2
                          ),
                          'createVisualizationV2 log'
                        )
                        logger().info(
                          {
                            workspaceId,
                            sessionId,
                            message: parsed.data.message,
                            input,
                          },
                          'createVisualizationV2 log'
                        )
                        break
                      case 'result':
                        result = parsed.data.data
                        break
                      default:
                        exhaustiveCheck(parsed.data)
                    }
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
