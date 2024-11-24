import axios from 'axios'
import split2 from 'split2'
import { config } from './config/index.js'
import { z } from 'zod'
import { DataFrame } from '@briefer/types'
import { decrypt } from '@briefer/database'

const base64Credentials = () =>
  Buffer.from(
    `${config().AI_API_USERNAME}:${config().AI_API_PASSWORD}`
  ).toString('base64')

export async function sqlEditStreamed(
  databaseURL: string,
  query: string,
  instructions: string,
  credentialsInfo: object | null,
  onSQL: (sql: string) => void,
  modelId: string | null,
  openaiApiKey: string | null
): Promise<{
  promise: Promise<void>
  abortController: AbortController
}> {
  const abortController = new AbortController()
  const response = await axios.post(
    `${config().AI_API_URL}/v1/stream/sql/edit`,
    {
      databaseURL,
      query,
      instructions,
      credentialsInfo,
      modelId,
      openaiApiKey: openaiApiKey
        ? decrypt(openaiApiKey, config().WORKSPACE_SECRETS_ENCRYPTION_KEY)
        : null,
    },
    {
      headers: {
        Authorization: `Basic ${base64Credentials()}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
      signal: abortController.signal,
    }
  )

  return {
    abortController,
    promise: new Promise(async (resolve, reject) => {
      let success = false
      let error: Error | null = null
      response.data
        .pipe(split2(JSON.parse))
        .on('data', (obj: any) => {
          const parse = z.object({ sql: z.string() }).safeParse(obj)
          if (parse.success) {
            onSQL(parse.data.sql)
            success = true
          } else {
            error = parse.error
          }
        })
        .on('error', reject)
        .on('finish', () => {
          if (!success) {
            reject(error ?? new Error('Got no data'))
          } else {
            resolve()
          }
        })
    }),
  }
}

export type PythonEditResponse = {
  source: string
}

export async function pythonEdit(
  source: string,
  instructions: string
): Promise<PythonEditResponse> {
  const allowedLibraries = (config().PYTHON_ALLOWED_LIBRARIES ?? '')
    .split(',')
    .map((s) => s.trim())

  const res = await fetch(`${config().AI_API_URL}/v1/python/edit`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${base64Credentials()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      source,
      instructions,
      allowedLibraries,
    }),
  })

  return (await res.json()) as PythonEditResponse
}

function dataframesToPython(dataframes: DataFrame[]): string {
  return dataframes
    .map((df) => {
      const columns = df.columns.map((c) => `'${c.name}'`).join(', ')
      return `${df.name} = pd.DataFrame(columns=[${columns}])`
    })
    .join('\n')
}

export async function pythonEditStreamed(
  source: string,
  instructions: string,
  dataFrames: DataFrame[],
  onSource: (source: string) => void,
  modelId: string | null,
  openaiApiKey: string | null
): Promise<void> {
  const allowedLibraries = (config().PYTHON_ALLOWED_LIBRARIES ?? '')
    .split(',')
    .map((s) => s.trim())

  const variables = dataframesToPython(dataFrames)

  const response = await axios.post(
    `${config().AI_API_URL}/v1/stream/python/edit`,
    {
      source,
      instructions,
      allowedLibraries,
      variables,
      modelId,
      openaiApiKey: openaiApiKey
        ? decrypt(openaiApiKey, config().WORKSPACE_SECRETS_ENCRYPTION_KEY)
        : null,
    },
    {
      headers: {
        Authorization: `Basic ${base64Credentials()}`,
        'Content-Type': 'application/json',
      },
      responseType: 'stream',
    }
  )

  return new Promise(async (resolve, reject) => {
    let success = false
    let error: Error | null = null
    response.data
      .pipe(split2(JSON.parse))
      .on('data', (obj: any) => {
        const parse = z.object({ source: z.string() }).safeParse(obj)
        if (parse.success) {
          onSource(parse.data.source)
          success = true
        } else {
          error = parse.error
        }
      })
      .on('error', reject)
      .on('finish', () => {
        if (!success) {
          reject(error ?? new Error('Got no data'))
        } else {
          resolve()
        }
      })
  })
}
