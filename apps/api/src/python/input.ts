import { DateInputValue } from '@briefer/editor'
import { logger } from '../logger.js'
import { executeCode } from './index.js'

export async function setVariable(
  workspaceId: string,
  sessionId: string,
  variable: string,
  value: string
) {
  const code = `${variable} = ${JSON.stringify(value)}`

  return executeCode(workspaceId, sessionId, code, () => {}, {
    storeHistory: false,
  })
}

export async function setDateTimeVariable(
  workspaceId: string,
  sessionId: string,
  variable: string,
  value: DateInputValue
) {
  let error: Error | null = null
  const code = `import pytz
from datetime import datetime
${variable} = pytz.timezone('${value.timezone}').localize(datetime(${value.year}, ${value.month}, ${value.day}, ${value.hours}, ${value.minutes}, ${value.seconds}))`

  await executeCode(
    workspaceId,
    sessionId,
    code,
    (outputs) => {
      for (const output of outputs) {
        if (output.type === 'error') {
          logger.error(
            {
              pythonError: output,
              workspaceId,
              sessionId,
              variable,
              value,
            },
            `Error setting datetime variable`
          )
          error = new Error(`${output.ename}: ${output.evalue}`)
        }
      }
    },
    {
      storeHistory: false,
    }
  ).then(({ promise }) => promise)

  if (error) {
    throw error
  }
}
