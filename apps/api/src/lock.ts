import prisma from '@briefer/database'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'
import { logger } from './logger.js'

const INTERVAL_MS = 5000
export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>,
  expirationTimeMs: number = 30000
): Promise<T> {
  const now = new Date()
  const expiresAt = new Date(now.getTime() + expirationTimeMs)
  const ownerId = uuidv4()

  try {
    let attempt = 1
    while (true) {
      logger.debug({ name, ownerId, attempt }, 'attempting to acquire lock')
      try {
        await prisma().lock.upsert({
          where: {
            name,
            OR: [
              { isLocked: false },
              {
                expiresAt: {
                  lte: now,
                },
              },
            ],
          },
          update: {
            isLocked: true,
            acquiredAt: now,
            expiresAt,
            ownerId,
          },
          create: {
            name,
            isLocked: true,
            acquiredAt: now,
            expiresAt: expiresAt,
            ownerId,
          },
        })
        logger.debug({ name, ownerId }, 'lock acquired')

        const interval = setInterval(async () => {
          logger.debug({ name, ownerId }, 'incrementing lock expiration time')
          await prisma().lock.update({
            where: {
              name,
              ownerId,
            },
            data: {
              expiresAt: new Date(new Date().getTime() + INTERVAL_MS),
            },
          })
        }, INTERVAL_MS)

        const r = await cb()
        clearInterval(interval)
        return r
      } catch (err) {
        // catch unique constraint violation
        if (z.object({ code: z.literal('P2002') }).safeParse(err).success) {
          logger.debug({ name, ownerId }, 'lock already acquired, retrying')
          await new Promise((resolve) => setTimeout(resolve, 200))
          attempt++
          continue
        }

        logger.error(
          {
            name,
            ownerId,
            err,
          },
          'error acquiring lock'
        )
        throw err
      }
    }
  } finally {
    logger.debug({ name, ownerId }, 'releasing lock')
    await prisma().lock.deleteMany({
      where: {
        name,
        ownerId,
      },
    })
    logger.debug({ name, ownerId }, 'lock released')
  }
}
