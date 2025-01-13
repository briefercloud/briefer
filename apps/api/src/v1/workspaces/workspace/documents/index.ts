import {
  prisma,
  getDocument,
  listDocuments,
  ApiDocument,
  toApiDocument,
} from '@briefer/database'
import { NextFunction, Router, Request, Response } from 'express'
import { getParam } from '../../../../utils/express.js'
import documentRouter from './document/index.js'
import { validate } from 'uuid'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { uuidSchema } from '@briefer/types'
import { IOServer } from '../../../../websocket/index.js'
import { upsertDocument } from '../../../../document-tree.js'
import { canUpdateWorkspace } from '../../../../auth/token.js'
import { broadcastDocument } from '../../../../websocket/workspace/documents.js'

export default function documentsRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.post(
    '/',
    canUpdateWorkspace,
    async (req, res: Response<ApiDocument>) => {
      const payload = z
        .object({
          id: z.string().optional(),
          parentId: uuidSchema.nullable().optional().default(null),
          version: z.number().optional(),
        })
        .safeParse(req.body)
      if (!payload.success) {
        res.status(400).end()
        return
      }

      const data = payload.data

      const workspaceId = getParam(req, 'workspaceId')

      let status = 500
      try {
        const document = await prisma().$transaction(async (tx) => {
          const result = await upsertDocument(
            data.id ?? uuidv4(),
            '',
            workspaceId,
            data.parentId,
            -1,
            data.version ?? 1,
            tx
          )

          if (result.created) {
            res.status(201)
          }

          return result.document
        })

        await broadcastDocument(socketServer, workspaceId, document.id)
        res.json(await toApiDocument(document))
      } catch (err) {
        if (status !== 500) {
          res.status(status).end()
          return
        }

        req.log.error({ err, workspaceId }, 'Failed to create document')
        res.status(500).end()
      }
    }
  )

  router.get('/', async (req, res: Response<ApiDocument[]>) => {
    const workspaceId = getParam(req, 'workspaceId')
    const docs = await listDocuments(workspaceId)
    res.json(docs)
  })

  async function belongsToWorkspace(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const workspaceId = getParam(req, 'workspaceId')
    const documentId = getParam(req, 'documentId')

    if (!validate(documentId) || !validate(workspaceId)) {
      res.status(400).end()
      return
    }

    const document = await getDocument(documentId)
    if (!document) {
      res.status(404).end()
      return
    }

    if (document.workspaceId !== workspaceId) {
      res.status(403).end()
      return
    }

    next()
  }

  router.use('/:documentId', belongsToWorkspace, documentRouter(socketServer))

  return router
}
