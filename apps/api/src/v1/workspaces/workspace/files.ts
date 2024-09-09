import { z } from 'zod'
import { Router } from 'express'
import { getParam } from '../../../utils/express.js'
import path from 'path'
import { getJupyterManager } from '../../../jupyter/index.js'

const filesRouter = Router({ mergeParams: true })

filesRouter.get('/', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')

  try {
    const jupyterManager = getJupyterManager()
    res.json(await jupyterManager.listFiles(workspaceId))
  } catch (err) {
    req.log.error({ workspaceId, err }, 'Error listing files')
    res.status(500).end()
  }
})

filesRouter.get('/file', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const filePath = req.query['path']
  if (typeof filePath !== 'string') {
    res.status(400).end()
    return
  }

  try {
    const fileName = path.basename(filePath)

    const getFileResult = await getJupyterManager().getFile(
      workspaceId,
      filePath
    )

    if (getFileResult === null) {
      res.status(404).end()
      return
    }

    const stream = getFileResult.stream

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    res.setHeader('Content-Length', getFileResult.size)
    stream.pipe(res)
    const exitCode = await getFileResult.exitCode
    if (exitCode !== 0) {
      req.log.error(
        { exitCode, workspaceId, filePath },
        'Error downloading file'
      )
      res.status(500).end()
      return
    }
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        filePath,
        err,
      },
      'Error downloading file'
    )
    res.status(500).end()
  }
})

filesRouter.post('/', async (req, res) => {
  const fileName = req.headers['x-file-name']
  if (!fileName || Array.isArray(fileName)) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')
  const replace = req.query['replace'] === 'true'
  const jupyterManager = getJupyterManager()
  try {
    const result = await jupyterManager.putFile(
      workspaceId,
      fileName,
      replace,
      req
    )

    const status: 409 | 204 = (() => {
      switch (result) {
        case 'already-exists':
          return 409
        case 'success':
          return 204
      }
    })()

    res.sendStatus(status)
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        fileName,
        err,
      },
      'Error uploading file'
    )
    res.status(500).end()
  }
})

filesRouter.delete('/', async (req, res) => {
  const body = z
    .object({
      path: z.string().min(1),
    })
    .safeParse(req.query)
  if (!body.success) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')

  try {
    await getJupyterManager().deleteFile(workspaceId, body.data.path)

    res.sendStatus(204)
  } catch (err) {
    req.log.error(
      { workspaceId, err, path: body.data.path },
      'Error deleting file'
    )
    res.status(500).end()
  }
})

export default filesRouter
