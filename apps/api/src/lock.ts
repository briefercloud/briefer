import crypto from 'crypto'
import { v4 as uuidv4 } from 'uuid'
import prisma, { publish, subscribe } from '@briefer/database'
import { logger } from './logger.js'
import { z } from 'zod'
import { exhaustiveCheck } from '@briefer/types'
import PQueue from 'p-queue'

const EXPIRATION_TIME = 1000 * 5 // 5 seconds
const RETRY_TIMEOUT = 1000 * 30 // 30 seconds in case pubsub fails
const NUM_PARTITIONS = 32

const queues = new Map<string, PQueue>()

function getPartition(name: string): number {
  const hash = crypto.createHash('md5').update(name).digest('hex')
  const hashValue = parseInt(hash.slice(0, 8), 16) // Use first 8 hex characters
  return hashValue % NUM_PARTITIONS
}

class AlreadyAcquiredError extends Error {
  constructor(public readonly lockName: string) {
    super(`Lock ${lockName} is already acquired.`)
    this.name = 'AlreadyAcquiredError'
  }
}

export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>
): Promise<T> {
  let lockQueue = queues.get(name)
  if (!lockQueue) {
    lockQueue = new PQueue({ concurrency: 1 })
    queues.set(name, lockQueue)
  }

  logger().trace(
    {
      name,
      queueSize: lockQueue.size,
      pending: lockQueue.pending,
    },
    'Enqueueing lock acquisition'
  )
  const result = await lockQueue.add(() => acquireLockInternal(name, cb))
  return result as T
}

async function acquireLockInternal<T>(
  name: string,
  cb: () => Promise<T>
): Promise<T> {
  const acquisitionQueue = new PQueue({ concurrency: 1 })

  const ownerId = uuidv4()
  let acquired = false
  let failed = false
  let attempt = 0
  let timeout: NodeJS.Timeout | null = null

  const channel = `lock_releases_${getPartition(name)}`

  return new Promise<T>(async (resolve, reject) => {
    let cleanSubscription: () => Promise<void> = async () => {}

    const tryAcquire = async () => {
      if (acquired || failed) {
        return
      }

      attempt++
      logger().trace({ name, ownerId, attempt, channel }, 'Acquiring lock')
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
          // this will fail to find the lock to update because clock will be different
          // that will raise a not found error that we catch below to retry
          await prisma().lock.update({
            where: {
              id: lock.id,
              clock: lock.clock,
            },
            data: {
              isLocked: true,
              ownerId,
              expiresAt: new Date(Date.now() + EXPIRATION_TIME),
              acquiredAt: new Date(),
              clock: {
                increment: 1,
              },
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
          logger().trace(
            {
              name,
              ownerId,
              attempt,
              code,
              retryTimeout: RETRY_TIMEOUT,
              channel,
            },
            `Lock is already acquired. Retrying in ${RETRY_TIMEOUT}.`
          )
          if (timeout) {
            clearTimeout(timeout)
          }
          timeout = setTimeout(
            () => acquisitionQueue.add(tryAcquire),
            RETRY_TIMEOUT
          )
          return
        }

        logger().error(
          { name, ownerId, channel, err },
          'Failed to acquire lock'
        )
        failed = true
        try {
          await cleanSubscription()
        } catch (err) {
          logger().error(
            { name, ownerId, channel, attempt, err },
            'Failed to clean subscription'
          )
        }
        reject(err)
        return
      }

      const extendExpirationInterval = setInterval(async () => {
        try {
          await prisma().lock.updateMany({
            where: {
              name,
              ownerId,
            },
            data: {
              expiresAt: new Date(Date.now() + EXPIRATION_TIME),
            },
          })
        } catch (err) {
          logger().error(
            {
              name,
              ownerId,
              channel,
              attempt,
              err,
            },
            'Failed to extend lock expiration time'
          )
        }
      }, EXPIRATION_TIME / 3)

      logger().debug({ name, ownerId, channel, attempt }, 'Lock acquired')
      acquired = true
      try {
        await cleanSubscription()
      } catch (err) {
        logger().error(
          { name, ownerId, channel, attempt, err },
          'Failed to clean subscription'
        )
      }

      let r:
        | { success: true; data: T }
        | { success: false; error: unknown }
        | null = null
      try {
        const data = await cb()
        r = { success: true, data }
      } catch (err) {
        r = { success: false, error: err }
      }

      logger().trace({ name, ownerId, channel, attempt }, 'Releasing lock')
      clearInterval(extendExpirationInterval)

      try {
        await prisma().lock.updateMany({
          where: {
            name,
            ownerId,
          },
          data: {
            isLocked: false,
          },
        })
        logger().debug({ name, ownerId, channel, attempt }, 'Lock released')
      } catch (err) {
        logger().error(
          { name, ownerId, channel, attempt, err },
          'Failed to release lock'
        )
      }

      try {
        await publish(channel, name)
      } catch (err) {
        logger().error(
          { name, ownerId, channel, attempt, err },
          'Failed to publish lock release'
        )
      }

      if (r.success) {
        resolve(r.data)
      } else {
        failed = true
        reject(r.error)
      }
    }

    cleanSubscription = await subscribe(channel, async (event) => {
      if (acquired || failed) {
        await cleanSubscription()
        return
      }

      if (event === name) {
        logger().trace(
          { name, ownerId, channel, attempt, queueSize: acquisitionQueue.size },
          'Got lock released message. Anticipating lock acquisition attempt'
        )

        acquisitionQueue.clear()
        acquisitionQueue.add(tryAcquire)
      }
    })

    acquisitionQueue.add(tryAcquire)
  })
}
