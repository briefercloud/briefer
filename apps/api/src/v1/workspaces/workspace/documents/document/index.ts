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
      let status = 500
      try {
        const doc = await prisma().$transaction(async (tx) => {
          const previousDoc = await getDocument(documentId, tx)
          if (!previousDoc) {
            status = 404
            throw new Error('Document not found')
          }

          if (payload.relations) {
            await moveDocument(
              previousDoc.id,
              workspaceId,
              payload.relations.parentId,
              payload.relations.orderIndex,
              tx
            )
          }

          const updatedDoc = await updateDocument(
            documentId,
            {
              title: bodyResult.data.title,
            },
            tx
          )

          return updatedDoc
        })

        res.json(await toApiDocument(doc))
      } catch (err) {
        if (status !== 500) {
          req.log.error(
            { err, status, documentId },
            'Failed to update document'
          )
          res.status(status).end()
          return
        }

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

      let status: number = 500
      try {
        const document = await prisma().$transaction(async (tx) => {
          const document = await getDocument(documentId, tx)
          if (!document || document.workspaceId !== workspaceId) {
            status = 404
            throw new Error('Document not found')
          }

          const deletedDoc = await deleteDocument(
            document.id,
            workspaceId,
            !isPermanent,
            tx
          )

          return { ...document, deletedAt: deletedDoc.deletedAt }
        })

        res.json(document)
      } catch (err) {
        if (status !== 500) {
          res.status(status).end()
          return
        }

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

      let status = 500
      try {
        const restoredDocument = await prisma().$transaction(async (tx) => {
          let document = await tx.document.findUnique({
            where: {
              id: documentId,
              workspaceId,
              deletedAt: { not: null },
            },
          })
          if (!document) {
            status = 400
            throw new Error('Document not found or not deleted')
          }

          return restoreDocument(document.id, workspaceId, tx)
        })

        res.json(await toApiDocument(restoredDocument))
      } catch (err) {
        if (status !== 500) {
          res.status(status).end()
          return
        }

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
        const duplicatedDocument = await prisma().$transaction(
          async (tx) => {
            const prevDoc = await tx.document.findUnique({
              where: {
                id: originalDocumentId,
                workspaceId,
                deletedAt: null,
              },
            })
            if (!prevDoc) {
              return null
            }

            return await duplicateDocument(
              prevDoc.id,
              workspaceId,
              socketServer,
              tx
            )
          },
          {
            maxWait: 11000,
            timeout: 10000,
          }
        )

        if (!duplicatedDocument) {
          req.log.error(
            { originalDocumentId, workspaceId },
            'Failed to duplicate document, document not found'
          )
          res.status(404).end()
          return
        }

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
