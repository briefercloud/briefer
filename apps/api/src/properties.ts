import prisma from '@briefer/database'
import { Properties } from '@briefer/types'

export default async function properties(): Promise<Properties> {
  const needsSetup = (await prisma().workspace.count()) === 0

  return {
    needsSetup,
  }
}
