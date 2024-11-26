import prisma, { getPGInstance } from '@briefer/database'
import { logger } from './logger.js'

export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>
): Promise<T> {
  const { pool } = await getPGInstance()

  const lock = await prisma().lock2.upsert({
    where: {
      name,
    },
    update: {},
    create: { name },
  })

  try {
    // acquire lock
    logger().trace({ name, id: lock.id }, 'Acquiring lock')
    await pool.query('SELECT pg_advisory_lock($1)', [lock.id])
    logger().trace({ name, id: lock.id }, 'Lock acquired')

    // run callback
    return await cb()
  } finally {
    // release lock
    logger().trace({ name, id: lock.id }, 'Releasing lock')
    await pool.query('SELECT pg_advisory_unlock($1)', [lock.id])
    logger().trace({ name, id: lock.id }, 'Lock released')
  }
}
