import { z } from 'zod'
import { Router } from 'express'
import prisma, { decrypt, encrypt } from '@briefer/database'
import { uuidSchema } from '@briefer/types'
import { config } from '../../../config/index.js'
import { getParam } from '../../../utils/express.js'
import { getJupyterManager } from '../../../jupyter/index.js'

const environmentVariablesRouter = Router({ mergeParams: true })

environmentVariablesRouter.get('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')

  try {
    const envVars = await prisma().environmentVariable.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    })

    res.json(
      envVars.map((v) => ({
        id: v.id,
        name: decrypt(v.name, config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY),
        value: '********************************',
      }))
    )
  } catch (err) {
    req.log.error({ workspaceId, err }, 'Error listing environment variables')
    res.status(500).end()
  }
})

environmentVariablesRouter.post('/', async (req, res) => {
  const body = z
    .object({
      add: z.array(z.object({ name: z.string(), value: z.string() })),
      remove: z.array(uuidSchema),
    })
    .safeParse(req.body)
  if (!body.success) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')

  try {
    await prisma().$transaction(
      async (tx) => {
        const removeNames = await tx.environmentVariable.findMany({
          where: { id: { in: body.data.remove }, workspaceId },
          select: { name: true },
        })
        await tx.environmentVariable.deleteMany({
          where: { id: { in: body.data.remove }, workspaceId },
        })

        await tx.environmentVariable.createMany({
          data: body.data.add.map((v) => ({
            name: encrypt(
              v.name,
              config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY
            ),
            value: encrypt(
              v.value,
              config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY
            ),
            workspaceId,
          })),
        })

        await getJupyterManager().setEnvironmentVariables(workspaceId, {
          add: body.data.add,
          remove: removeNames.map((v) =>
            decrypt(v.name, config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY)
          ),
        })
      },
      {
        maxWait: 31000,
        timeout: 30000,
      }
    )

    const envVars = await prisma().environmentVariable.findMany({
      where: { workspaceId },
      select: { id: true, name: true },
    })

    res.json(
      envVars.map((v) => ({
        id: v.id,
        name: decrypt(v.name, config().ENVIRONMENT_VARIABLES_ENCRYPTION_KEY),
        value: '********************************',
      }))
    )
  } catch (err) {
    req.log.error({ workspaceId, err }, 'Error saving environment variables')
    res.status(500).end()
  }
})

export default environmentVariablesRouter
