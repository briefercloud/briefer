import { Output, PythonErrorOutput } from '@briefer/types'
import * as services from '@jupyterlab/services'
import PQueue from 'p-queue'

import { logger } from '../logger.js'
import { getJupyterManager } from '../jupyter/index.js'
import prisma, { decrypt } from '@briefer/database'
import { config } from '../config/index.js'

export class PythonExecutionError extends Error {
  constructor(
    public etype: string,
    public ename: string,
    public evalue: string,
    public traceback: string[],
    message?: string
  ) {
    super(message ?? `${etype}: ${ename}: ${evalue}`)
    this.name = this.ename
  }

  public toPythonErrorOutput(): PythonErrorOutput {
    return {
      type: 'error',
      ename: this.ename,
      evalue: this.evalue,
      traceback: this.traceback,
    }
  }
}

export class PythonStderrError extends Error {
  constructor(
    public readonly workspaceId: string,
    public readonly sessionId: string,
    public readonly text: string,
    message?: string
  ) {
    super(
      message ??
        `Got stderr while executing Python code in workspace "${workspaceId}" session "${sessionId}"`
    )
    this.name = 'PythonStderrError'
  }
}

const getManager = async (workspaceId: string) => {
  const jupyterManager = getJupyterManager()
  const serverSettings = await jupyterManager.getServerSettings(workspaceId)
  const kernelManager = new services.KernelManager({ serverSettings })
  const sessionManager = new services.SessionManager({
    kernelManager,
    serverSettings,
  })

  return { kernelManager, sessionManager }
}

const executionQueues = new Map<string, PQueue>()
export async function executeCode(
  workspaceId: string,
  sessionId: string,
  code: string,
  onOutputs: (outputs: Output[]) => void,
  opts: { storeHistory: boolean }
) {
  const queueKey = `${workspaceId}-${sessionId}`
  let queue = executionQueues.get(queueKey)
  if (!queue) {
    queue = new PQueue({ concurrency: 1 })
    executionQueues.set(queueKey, queue)
  }

  let aborted = false
  let executing = false
  logger().debug(
    { workspaceId, sessionId, queueSize: queue.size },
    'Adding code to execution queue'
  )
  const promise = queue.add(async () => {
    if (aborted) {
      return
    }

    executing = true
    await innerExecuteCode(workspaceId, sessionId, code, onOutputs, opts)
  })

  return {
    async abort() {
      aborted = true

      if (executing) {
        const { kernel } = await getSession(workspaceId, sessionId)
        await kernel.interrupt()
        return
      }
    },
    promise,
  }
}

async function innerExecuteCode(
  workspaceId: string,
  sessionId: string,
  code: string,
  onOutputs: (outputs: Output[]) => void,
  { storeHistory }: { storeHistory: boolean }
): Promise<void> {

  const setupCode = `
import pandas as pd
# Display all rows
pd.set_option('display.max_rows', None)
# Display all columns
pd.set_option('display.max_columns', None)
# Don't wrap long strings
pd.set_option('display.max_colwidth', None)

# Override the DataFrame _repr_html_ method to exclude index
def custom_repr_html(self):
    return self.to_html(index=False)
pd.DataFrame._repr_html_ = custom_repr_html
`;
  
    const wrappedCode = `
${setupCode}
${code}
`

  logger().trace(
    { workspaceId, sessionId },
    'Starting Jupyter for code execution.'
  )
  const jupyterManager = getJupyterManager()
  await jupyterManager.ensureRunning(workspaceId)
  logger().trace({ workspaceId, sessionId }, 'Jupyter is up.')

  const { kernel } = await getSession(workspaceId, sessionId)
  const future = kernel.requestExecute({
    code: wrappedCode,
    allow_stdin: true,
    store_history: storeHistory,
  })

  let kernelRestarted = false
  kernel.statusChanged.connect((_, status) => {
    if (status === 'restarting' || status === 'autorestarting') {
      kernelRestarted = true
    }
  })

  future.onIOPub = (message) => {


    switch (message.header.msg_type) {
      case 'status':
        if ('execution_state' in message.content) {
          if (!['idle', 'busy'].includes(message.content.execution_state)) {
            logger().warn(
              {
                message: {
                  header: { msg_type: message.header.msg_type },
                  content: { execution_state: message.content.execution_state },
                },
              },
              'Got unexpected execution_state'
            )
          }
        } else {
          logger().warn({ message }, 'Got unsupported `status` message')
        }
        break
      case 'stream':
        if ('name' in message.content) {
          onOutputs([
            {
              type: 'stdio',
              name: message.content.name,
              text: message.content.text,
            },
          ])
        } else {
          logger().warn({ message }, 'Got unsupported `stream` message')
        }
        break
      case 'display_data':
      case 'execute_result':
        if (
          'data' in message.content &&
          'application/vnd.plotly.v1+json' in message.content.data &&
          message.content.data['application/vnd.plotly.v1+json'] &&
          typeof message.content.data['application/vnd.plotly.v1+json'] ===
            'object' &&
          'data' in message.content.data['application/vnd.plotly.v1+json']
          // :guitar:
        ) {
          onOutputs([
            {
              type: 'plotly',
              data: message.content.data['application/vnd.plotly.v1+json'][
                'data'
              ],
              layout:
                message.content.data['application/vnd.plotly.v1+json'][
                  'layout'
                ],
            },
          ])
        } else if (
          'data' in message.content &&
          'image/png' in message.content.data &&
          typeof message.content.data['image/png'] === 'string'
        ) {
          onOutputs([
            {
              type: 'image',
              data: message.content.data['image/png'],
              format: 'png',
            },
          ])
        } else if (
          'data' in message.content &&
          'text/html' in message.content.data
        ) {
          onOutputs([
            {
              type: 'html',
              html: message.content.data['text/html'] as string,
            },
          ])
        } else if (
          'data' in message.content &&
          'text/plain' in message.content.data
        ) {
          onOutputs([
            {
              type: 'stdio',
              name: 'stdout',
              text: message.content.data['text/plain'] as string,
            },
          ])
        } else {
          logger().warn(
            { message },
            `Got unsupported \`${message.header.msg_type}\` message`
          )
        }
        break
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
        } else {
          logger().warn({ message }, 'Got unsupported `error` message')
        }
        break
      case 'execute_input':
        break
      default:
        logger().warn({ message }, 'Got unsupported message type')
    }
  }

  logger().debug({ workspaceId, sessionId }, 'Waiting for code to execute')
  try {
    // For some reason, future.done not always resolves.
    // These fallbacks are here just to ensure the session won't
    // be stuck.
    // TODO: We need to eventually get to the bottom of this.
    let timeout: NodeJS.Timeout | null = null
    let done = false
    let status = kernel.status
    logger().trace(
      {
        workspaceId,
        sessionId,
        status,
      },
      'Waiting for kernel to become idle'
    )
    const idlePromise = new Promise<void>((resolve) => {
      function onStatusChanged(
        _: services.Kernel.IKernelConnection,
        newStatus: services.Kernel.Status
      ) {
        if (done) {
          return
        }

        logger().trace(
          {
            workspaceId,
            sessionId,
            status: newStatus,
          },
          'Kernel status changed'
        )

        if (status === newStatus) {
          return
        }

        if (timeout) {
          logger().trace(
            { workspaceId, sessionId, status, newStatus },
            'Clearing timeout'
          )
          clearTimeout(timeout)
        }

        if (newStatus === 'idle') {
          logger().trace(
            { workspaceId, sessionId, status, newStatus },
            'Setting timeout'
          )
          timeout = setTimeout(() => {
            if (!done) {
              logger().trace(
                { workspaceId, sessionId, status, newStatus },
                'Timeout reached'
              )
              done = true
            }

            kernel.statusChanged.disconnect(onStatusChanged)
            resolve()
          }, 60000)
        }
        status = newStatus
      }

      kernel.statusChanged.connect(onStatusChanged)
      if (status === 'idle') {
        logger().trace(
          { workspaceId, sessionId, status },
          'Initial idle status, setting timeout'
        )
        timeout = setTimeout(() => {
          if (!done) {
            done = true
          }

          kernel.statusChanged.disconnect(onStatusChanged)
          resolve()
        }, 60000)
      }
    })

    await Promise.race([future.done, idlePromise])
    done = true
  } catch (err) {
    if (kernelRestarted) {
      onOutputs([
        {
          type: 'error',
          ename: 'KernelRestarted',
          evalue: 'Kernel restarted during execution. Ran out of memory.',
          traceback: [],
        },
      ])
      return
    }
    throw err
  }
  logger().debug({ workspaceId, sessionId }, 'Code finished executing')
}

export async function cancelExecution(workspaceId: string, sessionId: string) {
  const { kernel } = await getSession(workspaceId, sessionId)
  await kernel.interrupt()
}

async function setEnvironmentVariables(
  kernel: services.Kernel.IKernelConnection,
  variables: { add: { name: string; value: string }[]; remove: string[] }
) {
  const code = ['import os']
    .concat(variables.remove.map((v) => `os.environ.pop('${v}', None)`))
    .concat(variables.add.map((v) => `os.environ['${v.name}'] = '${v.value}'`))
    .join('\n')

  await kernel.requestExecute({
    code,
    store_history: false,
  }).done
}

async function startNewSession(
  sessionManager: services.SessionManager,
  workspaceId: string,
  sessionId: string
) {
  const session = await sessionManager.startNew({
    path: sessionId,
    type: 'notebook',
    name: sessionId,
    kernel: {
      name: 'python',
    },
  })

  if (!session.kernel) {
    throw new Error('session.kernel is null')
  }

  const encryptedVariables = await prisma().environmentVariable.findMany({
    where: { workspaceId },
  })

  const variables = encryptedVariables.map((v) => ({
    name: decrypt(v.name, config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY),
    value: decrypt(v.value, config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY),
  }))

  await setEnvironmentVariables(session.kernel, {
    add: variables,
    remove: [],
  })

  return session
}

type Jupyter = {
  session: services.Session.ISessionConnection
  kernel: services.Kernel.IKernelConnection
}
const sessions = new Map<string, Jupyter>()
async function getSession(
  workspaceId: string,
  sessionId: string
): Promise<Jupyter> {
  const key = `${workspaceId}-${sessionId}`
  let jupyter = sessions.get(key)
  if (jupyter) {
    if (jupyter.kernel.connectionStatus === 'connected') {
      return jupyter
    }

    jupyter.kernel.dispose()
    jupyter.session.dispose()
    sessions.delete(key)
  }

  const { sessionManager } = await getManager(workspaceId)
  let sessionModel = await sessionManager.findByPath(sessionId)

  const session = sessionModel
    ? sessionManager.connectTo({ model: sessionModel })
    : await withRetry(() =>
        startNewSession(sessionManager, workspaceId, sessionId)
      )

  if (!session.kernel) {
    throw new Error('session.kernel is null')
  }

  jupyter = { session: session, kernel: session.kernel }
  sessions.set(key, jupyter)
  return jupyter
}

export async function updateEnvironmentVariables(
  workspaceId: string,
  variables: { add: { name: string; value: string }[]; remove: string[] }
) {
  await Promise.all(
    Array.from(sessions.entries()).map(async ([key, { kernel }]) => {
      if (key.startsWith(workspaceId)) {
        await setEnvironmentVariables(kernel, variables)
      }
    })
  )
}

async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 5,
  maxTimeout = 15000
): Promise<T> {
  let attempt = 1
  while (attempt <= maxRetries) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === maxRetries) {
        throw err
      }

      logger().warn({ attempt, err }, 'Retrying')
      attempt++
      // exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(2 ** attempt * 1000, maxTimeout))
      )
    }
  }

  return fn()
}

export async function getCompletion(
  workspaceId: string,
  sessionId: string,
  code: string,
  position: number
) {
  const jupyterManager = getJupyterManager()
  await jupyterManager.ensureRunning(workspaceId)

  const { kernel } = await getSession(workspaceId, sessionId)

  return kernel.requestComplete({
    code,
    cursor_pos: position,
  })
}

export async function renderJinja(
  workspaceId: string,
  sessionId: string,
  template: string
): Promise<string | PythonErrorOutput> {
  const code = `
def _briefer_render_template():
  from jinja2 import Template
  import json
  result = json.dumps({"type": "success", "result": Template(${JSON.stringify(
    template
  )}).render(**globals())})
  print(result)

_briefer_render_template()
del _briefer_render_template`

  let result: string | PythonErrorOutput | null = null
  const { promise } = await executeCode(
    workspaceId,
    sessionId,
    code,
    (outputs) => {
      for (const output of outputs) {
        if (output.type === 'stdio' && output.name === 'stdout') {
          const lines = output.text.trim().split('\n')
          for (const line of lines) {
            const parsed = JSON.parse(line.trim())
            switch (parsed.type) {
              case 'success':
                result = parsed.result
                break
              default:
                throw new Error('Unexpected output: ' + line)
            }
          }
        } else if (output.type === 'error') {
          result = {
            type: 'error',
            ename: output.ename,
            evalue: output.evalue,
            traceback: output.traceback,
          }
        }
      }
    },
    { storeHistory: false }
  )
  await promise

  if (!result) {
    throw new Error('Got no result from rendering template')
  }

  return result
}

export async function disposeAll(workspaceId: string) {
  await Promise.all(
    Array.from(sessions.entries()).map(async ([key, { kernel, session }]) => {
      if (key.startsWith(workspaceId)) {
        await session.shutdown()
        await kernel.shutdown()
        session.dispose()
        kernel.dispose()
      }
    })
  )
  sessions.clear()
}
