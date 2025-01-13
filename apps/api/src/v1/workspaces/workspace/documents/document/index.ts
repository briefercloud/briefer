import {
  prisma,
  updateDocument,
  getDocument,
  ApiDocument,
  toApiDocument,
} from '@briefer/database'
import { z } from 'zod'
import { Router, Response } from 'express'

import iconRouter from './icon.js'
import commentsRouter from './comments.js'
import favoriteRouter from './favorite.js'
import filesRouter from './files.js'
import queriesRouter from './queries/index.js'
import schedulesRouter from './schedules/index.js'
import { getParam } from '../../../../../utils/express.js'
import { IOServer } from '../../../../../websocket/index.js'
import { uuidSchema } from '@briefer/types'
import {
  deleteDocument,
  duplicateDocument,
  moveDocument,
  restoreDocument,
} from '../../../../../document-tree.js'
import inputsRouter from './inputs.js'
import publishRouter from './publish.js'
import { canUpdateWorkspace } from '../../../../../auth/token.js'
import settingsRouter from './settings.js'

export default function documentRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.get('/', async (req, res: Response<ApiDocument>) => {
    const documentId = getParam(req, 'documentId')
    const doc = await getDocument(documentId)
    if (!doc) {
      res.status(404).end()
      return
    }

    res.json(doc)
  })

  router.put(
    '/',
    canUpdateWorkspace,
    async (req, res: Response<ApiDocument>) => {
      const workspaceId = getParam(req, 'workspaceId')
      const documentId = getParam(req, 'documentId')
      const bodyResult = z
        .object({
          title: z.string().optional(),
          content: z.string().optional(),
          relations: z
            .object({
              parentId: uuidSchema.nullable(),
              orderIndex: z.number(),
            })
            .optional(),
        })
        .safeParse(req.body)

      if (!bodyResult.success) {
        res.status(400).end()
        return
      }

      const payload = bodyResult.data
      try {
        const previousDoc = await getDocument(documentId)
        if (!previousDoc) {
          res.status(404).end()
          return
        }

        if (payload.relations) {
          const { parentId, orderIndex } = payload.relations
          await prisma().$transaction(async (tx) =>
            moveDocument(previousDoc.id, workspaceId, parentId, orderIndex, tx)
          )
        }

        const doc = await updateDocument(documentId, {
          title: bodyResult.data.title,
        })

        res.json(await toApiDocument(doc))
      } catch (err) {
        req.log.error({ err, documentId }, 'Failed to update document')
        res.status(500).end()
      }
    }
  )

  router.delete(
    '/',
    canUpdateWorkspace,
    async (req, res: Response<ApiDocument>) => {
      const workspaceId = getParam(req, 'workspaceId')
      const documentId = getParam(req, 'documentId')
      const isPermanent = req.query['isPermanent'] === 'true'

      try {
        const document = await getDocument(documentId)
        if (!document) {
          res.status(404).end()
          return
        }

        const deletedDoc = await deleteDocument(
          documentId,
          workspaceId,
          !isPermanent
        )

        res.json({ ...document, deletedAt: deletedDoc.deletedAt })
      } catch (err) {
        req.log.error(
          { err, documentId, isPermanent },
          'Failed to delete document'
        )
        res.status(500).end()
      }
    }
  )

  router.post(
    '/restore',
    canUpdateWorkspace,
    async (req, res: Response<ApiDocument>) => {
      const documentId = getParam(req, 'documentId')
      const workspaceId = getParam(req, 'workspaceId')

      try {
        let doc = await prisma().document.findUnique({
          where: {
            id: documentId,
            workspaceId,
            deletedAt: { not: null },
          },
          select: { id: true },
        })
        if (!doc) {
          res.status(400).end()
          return
        }

        const restoredDocument = await prisma().$transaction(async (tx) =>
          restoreDocument(doc.id, workspaceId, tx)
        )

        res.json(await toApiDocument(restoredDocument))
      } catch (err) {
        req.log.error({ err, documentId }, 'Failed to restore document')
        res.status(500).end()
      }
    }
  )

  router.post(
    '/duplicate',
    canUpdateWorkspace,
    async (req, res: Response<ApiDocument>) => {
      const originalDocumentId = getParam(req, 'documentId')
      const workspaceId = getParam(req, 'workspaceId')

      try {
        const prevDoc = await prisma().document.findUnique({
          where: {
            id: originalDocumentId,
            workspaceId,
            deletedAt: null,
          },
        })
        if (!prevDoc) {
          req.log.error(
            { originalDocumentId, workspaceId },
            'Failed to duplicate document, document not found'
          )
          res.status(404).end()
          return
        }

        const duplicatedDocument = await duplicateDocument(
          prevDoc.id,
          workspaceId,
          socketServer
        )

        res.status(201).json(await toApiDocument(duplicatedDocument))
      } catch (err) {
        req.log.error(
          { originalDocumentId, workspaceId, err },
          'Failed to duplicate document'
        )
        res.status(500).end()
      }
    }
  )

  router.use('/queries', queriesRouter)
  router.use('/schedules', canUpdateWorkspace, schedulesRouter)
  router.use('/comments', commentsRouter(socketServer))
  router.use('/favorite', favoriteRouter)
  router.use('/files', canUpdateWorkspace, filesRouter)
  router.use('/icon', canUpdateWorkspace, iconRouter)
  router.use('/inputs', canUpdateWorkspace, inputsRouter)
  router.use('/publish', canUpdateWorkspace, publishRouter(socketServer))
  router.use('/settings', canUpdateWorkspace, settingsRouter(socketServer))

  return router
}
