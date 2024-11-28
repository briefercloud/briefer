import { v4 as uuidv4 } from 'uuid'
import prisma from '@briefer/database'
import { logger } from './logger.js'
import { z } from 'zod'
import { exhaustiveCheck } from '@briefer/types'

const EXPIRATION_TIME = 1000 * 5 // 5 seconds
const MAX_RETRY_TIMEOUT = 500 // 500ms
const DEFAULT_ACQUIRE_TIMEOUT = Infinity

class AlreadyAcquiredError extends Error {
  constructor(public readonly lockName: string) {
    super(`Lock ${lockName} is already acquired.`)
    this.name = 'AlreadyAcquiredError'
  }
}

export class AcquireLockTimeoutError extends Error {
  constructor(
    public readonly name: string,
    public readonly ownerId: string,
    public readonly startTime: number,
    public readonly acquireTimeout: number,
    public readonly attempt: number
  ) {
    super(
      `Failed to acquire lock ${name} with ownerId ${ownerId} after ${acquireTimeout}ms and ${attempt} attempts.`
    )
    this.name = 'AcquireLockTimeoutError'
  }
}

export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>,
  { acquireTimeout = DEFAULT_ACQUIRE_TIMEOUT }: { acquireTimeout?: number } = {}
): Promise<T> {
  const startTime = Date.now()
  const ownerId = uuidv4()

  const inner = async (attempt: number): Promise<T> => {
    if (Date.now() - startTime > acquireTimeout) {
      throw new AcquireLockTimeoutError(
        name,
        ownerId,
        startTime,
        acquireTimeout,
        attempt
      )
    }

    logger().trace({ name, ownerId, attempt }, 'Acquiring lock')
    try {
      const lock = await prisma().lock.findFirst({
        where: {
          name,
        },
      })
      if (!lock) {
        // this is safe because if someone else creates the lock in the meantime
        // this will raise a unique constraint error that we catch below to retry
        await prisma().lock.create({
          data: {
            name,
            isLocked: true,
            ownerId,
            expiresAt: new Date(Date.now() + EXPIRATION_TIME),
            acquiredAt: new Date(),
          },
        })
      } else if (!lock.isLocked || lock.expiresAt < new Date()) {
        // this is safe because if someone else updates the lock in the meantime
        // this will fail to find the lock to update because expiresAt will be changed
        // that will raise a not found error that we catch below to retry
        await prisma().lock.update({
          where: {
            id: lock.id,
            expiresAt: lock.expiresAt,
          },
          data: {
            isLocked: true,
            ownerId,
            expiresAt: new Date(Date.now() + EXPIRATION_TIME),
            acquiredAt: new Date(),
          },
        })
      } else {
        // lock is already acquired
        throw new AlreadyAcquiredError(name)
      }
    } catch (err) {
      let code = ''
      if (err instanceof AlreadyAcquiredError) {
        code = 'AlreadyAcquiredError'
      } else {
        const parsed = z
          .object({ code: z.union([z.literal('P2002'), z.literal('P2025')]) })
          .safeParse(err)
        if (parsed.success) {
          switch (parsed.data.code) {
            case 'P2002':
              code = 'UniqueConstraintError'
              break
            case 'P2025':
              code = 'NotFound'
              break
            default:
              exhaustiveCheck(parsed.data.code)
          }
        }
      }

      if (code !== '') {
        const timeout = Math.min(MAX_RETRY_TIMEOUT, Math.pow(2, attempt) * 100)
        logger().trace(
          { name, ownerId, attempt, code, timeout },
          'Lock is already acquired. Retrying.'
        )
        await new Promise((resolve) => setTimeout(resolve, timeout))
        return inner(attempt + 1)
      }

      logger().error({ name, ownerId, err }, 'Failed to acquire lock')
      throw err
    }

    const extendExpirationInterval = setInterval(async () => {
      await prisma().lock.updateMany({
        where: {
          name,
          ownerId,
        },
        data: {
          expiresAt: new Date(Date.now() + EXPIRATION_TIME),
        },
      })
    }, EXPIRATION_TIME / 3)

    logger().debug({ name, ownerId }, 'Lock acquired')

    try {
      return await cb()
    } finally {
      logger().trace({ name, ownerId }, 'Releasing lock')
      clearInterval(extendExpirationInterval)
      await prisma().lock.updateMany({
        where: {
          name,
          ownerId,
        },
        data: {
          isLocked: false,
        },
      })
      logger().debug({ name, ownerId }, 'Lock released')
    }
  }

  return inner(0)
}
