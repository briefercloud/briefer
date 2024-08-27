import { z } from 'zod'

import { getParam } from '../../../../../../../utils/express.js'
import { Response, Request, Router } from 'express'
import csvRouter from './csv.js'
import { readDataframePage } from '../../../../../../../python/query/index.js'
import { getJupyterManager } from '../../../../../../../jupyter/index.js'

const queryRouter = Router({ mergeParams: true })

export async function getQueryHandler(req: Request, res: Response) {
  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')

  const payload = z
    .object({
      dataframeName: z.string(),
      page: z.preprocess(
        (a) => parseInt(z.string().parse(a), 10),
        z.number().nonnegative()
      ),
      pageSize: z.preprocess(
        (a) => parseInt(z.string().parse(a), 10),
        z.number().nonnegative()
      ),
    })
    .safeParse(req.query)

  if (!payload.success) {
    res.status(400).end()
    return
  }

  const data = payload.data

  const pageSize = Math.min(data.pageSize, 250)
  const queryId = getParam(req, 'queryId')

  try {
    await getJupyterManager().ensureRunning(workspaceId)
    const result = await readDataframePage(
      workspaceId,
      documentId,
      queryId,
      data.dataframeName,
      data.page,
      pageSize
    )
    if (!result) {
      res.status(404).end()
      return
    }

    res.json(result)
  } catch (err) {
    req.log.error(
      { err, workspaceId, documentId, queryId },
      'Error while executing query'
    )
    res.status(500).json({ error: 'unexpected' })
  }
}

queryRouter.get('/', getQueryHandler)
queryRouter.use('/csv', csvRouter)

export default queryRouter
