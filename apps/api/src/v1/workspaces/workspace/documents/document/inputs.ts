import { Router } from 'express'
import { getParam } from '../../../../../utils/express.js'
import { z } from 'zod'
import { setVariable } from '../../../../../python/input.js'

const inputsRouter = Router({ mergeParams: true })

const varNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

inputsRouter.post('/:blockId', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')

  const body = z
    .object({
      variable: z.string(),
      value: z.string(),
    })
    .safeParse(req.body)
  if (!body.success) {
    res.status(400).json({ reason: 'invalid-payload' })
    return
  }

  const variable = body.data.variable
  if (!varNameRegex.test(variable)) {
    res.status(400).json({ reason: 'invalid-variable-name' })
    return
  }

  try {
    await setVariable(
      workspaceId,
      documentId,
      body.data.variable,
      body.data.value
    ).then(({ promise }) => promise)
    res.sendStatus(204)
  } catch (err) {
    req.log.error(
      { err, workspaceId, documentId },
      'Error setting python input'
    )
    res.status(500).end()
    return
  }
})

export default inputsRouter
