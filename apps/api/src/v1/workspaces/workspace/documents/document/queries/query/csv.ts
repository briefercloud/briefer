import { getParam } from '../../../../../../../utils/express.js'
import { Router } from 'express'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'
import { getJupyterManager } from '../../../../../../../jupyter/index.js'

const csvRouter = Router({ mergeParams: true })

csvRouter.get('/', async (req, res) => {
  const queryId = uuidSchema.safeParse(getParam(req, 'queryId'))
  if (!queryId.success) {
    res.status(400).end()
    return
  }

  const name = z.string().safeParse(req.query['name'])
  if (!name.success) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')

  // we validated that queryId.date is a uuid, so no need to fear path traversal
  const filepath = `.briefer/query-${queryId.data}.csv`

  const jupyterManager = getJupyterManager()
  await jupyterManager.ensureRunning(workspaceId)
  const fileRes = await jupyterManager.getFile(workspaceId, filepath)

  if (!fileRes) {
    res.status(404).end()
    return
  }

  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', `attachment; filename="${name}.csv"`)
  res.setHeader('Content-Length', fileRes.size)
  fileRes.stream.pipe(res)
})

export default csvRouter
