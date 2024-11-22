import { parse as parseUUID } from 'uuid'
import prisma, { getPGInstance } from '@briefer/database'
import { logger } from './logger.js'

// PostgreSQL advisory lock key is a 64-bit integer
//
// However we use UUIDs as identifiers in our database and JavaScript
// only supports 53-bit integers
//
// So, we convert UUIDs to two 32-bit integers since PostgreSQL advisory
// lock can accept two 32-bit integers as a key
function uuidToPGLockKey(uuid: string) {
  const binaryId: Uint8Array = parseUUID(uuid)
  const view = new DataView(binaryId.buffer)

  // first 32 bits
  const fst = view.getInt32(0)

  // last 32 bits
  const snd = view.getInt32(4)

  return [fst, snd]
}

export async function acquireLock<T>(
  name: string,
  cb: () => Promise<T>
): Promise<T> {
  const { pgClient } = await getPGInstance()

  const lock = await prisma().lock.upsert({
    where: {
      name,
    },
    update: {},
    create: { name },
  })

  const [fst, snd] = uuidToPGLockKey(lock.id)

  try {
    // acquire lock
    logger().trace({ name, fst, snd }, 'Acquiring lock')
    await pgClient.query('SELECT pg_advisory_lock($1, $2)', [fst, snd])
    logger().trace({ name, fst, snd }, 'Lock acquired')

    // run callback
    return await cb()
  } finally {
    // release lock
    logger().trace({ name, fst, snd }, 'Releasing lock')
    await pgClient.query('SELECT pg_advisory_unlock($1, $2)', [fst, snd])
    logger().trace({ name, fst, snd }, 'Lock released')
  }
}
