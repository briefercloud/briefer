import { Router } from 'express'

import { getParam } from '../../../../../utils/express.js'
import { getJupyterManager } from '../../../../../jupyter/index.js'

const filesRouter = Router({ mergeParams: true })

filesRouter.post('/', async (req, res) => {
  const fileName = req.headers['x-file-name']
  if (!fileName || Array.isArray(fileName)) {
    res.status(400).end()
    return
  }

  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')
  const replace = req.query['replace'] === 'true'

  const jupyterManager = getJupyterManager()
  await jupyterManager.ensureRunning(workspaceId)

  try {
    if (!replace) {
      const fileExists = await jupyterManager.fileExists(workspaceId, fileName)

      if (fileExists) {
        res.status(409).end()
        return
      }
    }

    req.log.info({ fileName, workspaceId }, 'Uploading file')

    await jupyterManager.putFile(workspaceId, fileName, req)

    req.log.info({ filename: fileName, workspaceId }, 'File uploaded')

    res.status(204).end()
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        documentId,
        err,
      },
      'Error uploading file'
    )
    res.status(500).end()
  }
})

filesRouter.get('/:fileName', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')
  const fileName = getParam(req, 'fileName')

  const jupyterManager = getJupyterManager()

  try {
    await jupyterManager.ensureRunning(workspaceId)

    const getFileResult = await jupyterManager.getFile(workspaceId, fileName)

    if (getFileResult === null) {
      res.status(500).end()
      req.log.error(
        { workspaceId },
        'Error getting contents API while downloading file'
      )
      return
    }

    const stream = getFileResult.stream

    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`)
    res.setHeader('Content-Length', getFileResult.size)
    stream.pipe(res)
    const exitCode = await getFileResult.exitCode
    if (exitCode !== 0) {
      req.log.error({ exitCode, workspaceId }, 'Error downloading file')
      res.status(500).end()
      return
    }
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        documentId,
        err,
      },
      'Error downloading file'
    )
    res.status(500).end()
  }
})

filesRouter.delete('/:fileName', async (req, res) => {
  const workspaceId = getParam(req, 'workspaceId')
  const documentId = getParam(req, 'documentId')
  const fileName = getParam(req, 'fileName')

  try {
    const jupyterManager = getJupyterManager()
    await jupyterManager.ensureRunning(workspaceId)

    await jupyterManager.deleteFile(workspaceId, fileName)
    res.sendStatus(204)
  } catch (err) {
    req.log.error(
      {
        workspaceId,
        documentId,
        err,
      },
      'Error deleting file'
    )
    res.sendStatus(500)
  }
})

export default filesRouter
