import prisma, { getPGInstance } from '@briefer/database'
import { logger } from './logger.js'
import { z } from 'zod'

export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>
): Promise<T> {
  const { pool } = await getPGInstance()

  let lockId = BigInt(-1)
  while (true) {
    try {
      const lock = await prisma().lock2.upsert({
        where: {
          name,
        },
        update: {},
        create: { name },
      })
      lockId = lock.id

      // acquire lock
      logger().trace({ name, id: lock.id }, 'Acquiring lock')
      await pool.query('SELECT pg_advisory_lock($1)', [lock.id])
      logger().trace({ name, id: lock.id }, 'Lock acquired')

      // run callback
      return await cb()
    } catch (err) {
      if (z.object({ code: z.literal('P2002') }).safeParse(err).success) {
        continue
      }

      throw err
    } finally {
      // release lock
      logger().trace({ name, id: lockId }, 'Releasing lock')
      await pool.query('SELECT pg_advisory_unlock($1)', [lockId])
      logger().trace({ name, id: lockId }, 'Lock released')
    }
  }
}
