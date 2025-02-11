import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime'
import { createHash } from 'crypto'
import prisma from '@briefer/database'
import { OpenAI } from 'openai'
import { head } from 'ramda'
import { z } from 'zod'
import { logger } from './logger.js'
import { jsonString } from '@briefer/types'
import AggregateError from 'aggregate-error'

const OPENAI_EMBEDDING_MODEL = 'text-embedding-3-small'

const BEDROCK_EMBEDDING_MODELS = [
  'amazon.titan-embed-text-v2:0',
  'amazon.titan-embed-text-v1',
]

const MODELS = [OPENAI_EMBEDDING_MODEL, ...BEDROCK_EMBEDDING_MODELS]

export async function createEmbedding(
  input: string,
  openAiApiKey: string | null
): Promise<{ embedding: number[]; model: string } | null> {
  const inputChecksum = createHash('sha256').update(input).digest('hex')
  for (const model of MODELS) {
    const rawExistingEmbeddings = await prisma()
      .$queryRaw`SELECT embedding::text FROM "EmbeddingCache" WHERE "inputChecksum" = ${inputChecksum} AND model = ${model}`

    const parsedExistingEmbeddings = z
      .array(z.object({ embedding: jsonString.pipe(z.array(z.number())) }))
      .safeParse(rawExistingEmbeddings)

    if (parsedExistingEmbeddings.success) {
      const embedding = head(parsedExistingEmbeddings.data)?.embedding
      if (embedding) {
        return { embedding, model }
      }
    } else {
      logger().error(
        {
          err: parsedExistingEmbeddings.error,
        },
        'Failed to parse existing embeddings'
      )
    }
  }

  if (openAiApiKey) {
    const result = await createEmbeddingFromOpenAI(
      input,
      inputChecksum,
      openAiApiKey
    )
    return result
  }

  const embedding = await createEmbeddingFromBedrock(input, inputChecksum)
  return embedding
}

async function createEmbeddingFromOpenAI(
  input: string,
  inputChecksum: string,
  openAiApiKey: string
): Promise<{ embedding: number[]; model: string }> {
  const openai = new OpenAI({ apiKey: openAiApiKey })
  const embeddingResponse = await openai.embeddings.create({
    model: OPENAI_EMBEDDING_MODEL,
    input,
  })
  const embedding = head(embeddingResponse.data)?.embedding
  if (!embedding) {
    throw new Error(
      `OpenAI(${OPENAI_EMBEDDING_MODEL}) did not return any embeddings`
    )
  }
  await persistEmbedding(inputChecksum, OPENAI_EMBEDDING_MODEL, embedding)
  return { embedding, model: OPENAI_EMBEDDING_MODEL }
}

async function persistEmbedding(
  inputChecksum: string,
  model: string,
  embedding: number[]
) {
  try {
    await prisma()
      .$queryRaw`INSERT INTO "EmbeddingCache" ("inputChecksum", model, embedding) VALUES (${inputChecksum}, ${model}, ${embedding}::vector) ON CONFLICT DO NOTHING`
  } catch (err) {
    logger().error(
      {
        err,
      },
      'Failed to insert embedding into cache'
    )
  }
}

async function createEmbeddingFromBedrock(
  input: string,
  inputChecksum: string
): Promise<{ embedding: number[]; model: string }> {
  const errors: Error[] = []
  const client = new BedrockRuntimeClient({
    region: process.env['AWS_REGION'] ?? 'us-east-1',
  })
  const payload = { inputText: input }
  for (const model of BEDROCK_EMBEDDING_MODELS) {
    const command = new InvokeModelCommand({
      modelId: model,
      body: JSON.stringify(payload),
      contentType: 'application/json',
      accept: 'application/json',
    })

    try {
      const response = await client.send(command)
      const responseBody = JSON.parse(new TextDecoder().decode(response.body))

      const embedding = responseBody.embedding
      if (!embedding) {
        errors.push(
          new Error(`BedRock(${model}) did not return any embeddings`)
        )
        continue
      }
      await persistEmbedding(inputChecksum, model, embedding)
      return { embedding, model }
    } catch (err) {
      errors.push(err as Error)
    }
  }

  throw new AggregateError([
    new Error('Failed to generate embeddings with Bedrock'),
    ...errors,
  ])
}
