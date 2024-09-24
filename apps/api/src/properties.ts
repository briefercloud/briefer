import prisma from '@briefer/database'
import { Properties } from '@briefer/types'
import { config } from './config/index.js'

export default async function properties(): Promise<Properties> {
  const needsSetup = (await prisma().workspace.count()) === 0
  const disableCustomOpenAiKey = config().DISABLE_CUSTOM_OAI_KEY

  return {
    needsSetup,
    disableCustomOpenAiKey,
    disabledAnonymousTelemetry: config().DISABLE_ANONYMOUS_TELEMETRY,
  }
}
