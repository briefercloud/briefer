import { Router } from 'express'
import { getParam } from '../../../../../utils/express.js'
import { z } from 'zod'
import { IOServer } from '../../../../../websocket/index.js'
import prisma from '@briefer/database'
import { broadcastDocument } from '../../../../../websocket/workspace/documents.js'

const DocumentSettings = z.object({
  runUnexecutedBlocks: z.boolean(),
})

export default function settingsRouter(socketServer: IOServer) {
  const publishRouter = Router({ mergeParams: true })

  publishRouter.put('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')
    const body = DocumentSettings.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ reason: 'invalid-payload' })
      return
    }

    const runUnexecutedBlocks = body.data.runUnexecutedBlocks

    try {
      await prisma().$transaction(async (tx) => {
        const doc = await tx.document.update({
          where: { id: documentId },
          data: { runUnexecutedBlocks },
        })

        if (!doc) {
          res.status(404).end()
          return
        }
      })

      await broadcastDocument(socketServer, workspaceId, documentId)

      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          documentId,
          err,
        },
        'Failed to publish document'
      )
      res.status(500).end()
    }
  })

  return publishRouter
}
