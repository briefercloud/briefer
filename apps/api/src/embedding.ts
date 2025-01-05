import { createHash } from 'crypto'
import prisma from '@briefer/database'
import { OpenAI } from 'openai'
import { head } from 'ramda'
import { z } from 'zod'
import { logger } from './logger.js'
import { jsonString } from '@briefer/types'

export async function createEmbedding(input: string, openAiApiKey: string) {
  const model = 'text-embedding-3-small'
  const inputChecksum = createHash('sha256').update(input).digest('hex')
  const rawExistingEmbeddings = await prisma()
    .$queryRaw`SELECT embedding::text FROM "EmbeddingCache" WHERE "inputChecksum" = ${inputChecksum} AND model = ${model}`

  const parsedExistingEmbeddings = z
    .array(z.object({ embedding: jsonString.pipe(z.array(z.number())) }))
    .safeParse(rawExistingEmbeddings)
  if (parsedExistingEmbeddings.success) {
    const embedding = head(parsedExistingEmbeddings.data)?.embedding
    if (embedding) {
      return embedding
    }
  } else {
    logger().error(
      {
        err: parsedExistingEmbeddings.error,
      },
      'Failed to parse existing embeddings'
    )
  }

  const openai = new OpenAI({ apiKey: openAiApiKey })
  const embeddingResponse = await openai.embeddings.create({
    model,
    input,
  })
  const embedding = head(embeddingResponse.data)?.embedding
  if (!embedding) {
    throw new Error('OpenAI did not return any embeddings')
  }

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

  return embedding
}
