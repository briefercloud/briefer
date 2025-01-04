import { Router } from 'express'
import { getParam } from '../../../../../utils/express.js'
import { z } from 'zod'
import { IOServer } from '../../../../../websocket/index.js'
import prisma, { recoverFromNotFound } from '@briefer/database'
import { broadcastDocument } from '../../../../../websocket/workspace/documents.js'

const DocumentSettings = z.object({
  runUnexecutedBlocks: z.boolean().optional(),
  runSQLSelection: z.boolean().optional(),
  shareLinksWithoutSidebar: z.boolean().optional(),
})

export default function settingsRouter(socketServer: IOServer) {
  const settingsRouter = Router({ mergeParams: true })

  settingsRouter.put('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')
    const body = DocumentSettings.safeParse(req.body)
    if (!body.success) {
      res.status(400).json({ reason: 'invalid-payload' })
      return
    }

    const { runUnexecutedBlocks, runSQLSelection, shareLinksWithoutSidebar } =
      body.data

    try {
      const doc = await recoverFromNotFound(
        prisma().document.update({
          where: { id: documentId },
          data: {
            runUnexecutedBlocks,
            runSQLSelection,
            shareLinksWithoutSidebar,
          },
        })
      )
      if (!doc) {
        res.status(404).end()
        return
      }

      await broadcastDocument(socketServer, workspaceId, documentId)

      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        {
          workspaceId,
          documentId,
          err,
        },
        'Failed to update document settings'
      )
      res.status(500).end()
    }
  })

  return settingsRouter
}
