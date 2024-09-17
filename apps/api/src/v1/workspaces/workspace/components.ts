import { Router } from 'express'
import prisma, {
  createReusableComponent,
  NewReusableComponent,
  updateReusableComponent,
  UpdateReusableComponent,
} from '@briefer/database'

import { IOServer } from '../../../websocket/index.js'
import {
  broadcastComponent,
  broadcastComponentRemoved,
} from '../../../websocket/workspace/components.js'
import { getParam } from '../../../utils/express.js'
import { getDocId, getYDocForUpdate } from '../../../yjs/v2/index.js'
import { DocumentPersistor } from '../../../yjs/v2/persistors.js'
import {
  decodeComponentState,
  switchBlockType,
  updateBlockFromComponent,
} from '@briefer/editor'
import PQueue from 'p-queue'
import { logger } from '../../../logger.js'

export default function componentsRouter(socketServer: IOServer) {
  const router = Router({ mergeParams: true })

  router.post('/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const payload = NewReusableComponent.safeParse(req.body)
    if (!payload.success) {
      res.sendStatus(400)
      return
    }

    try {
      const belongsToWorkspace = await prisma().document.findFirst({
        where: { id: payload.data.documentId, workspaceId },
      })
      if (!belongsToWorkspace) {
        res.sendStatus(403)
        return
      }

      await prisma().$transaction(async (tx) => {
        const component = await createReusableComponent(payload.data, tx)
        await getYDocForUpdate(
          getDocId(payload.data.documentId, null),
          socketServer,
          payload.data.documentId,
          workspaceId,
          async (ydoc) => {
            const block = ydoc.blocks.get(payload.data.blockId)
            if (!block) {
              throw new Error(
                `Could not find block ${payload.data.blockId} in document ${payload.data.documentId}`
              )
            }

            switchBlockType(block, {
              onSQL: (block) => block.setAttribute('componentId', component.id),
              onPython: (block) =>
                block.setAttribute('componentId', component.id),
              onRichText: () => {},
              onVisualization: () => {},
              onInput: () => {},
              onDropdownInput: () => {},
              onDateInput: () => {},
              onFileUpload: () => {},
              onDashboardHeader: () => {},
              onWriteback: () => {},
              onPivotTable: () => {},
            })
          },
          new DocumentPersistor(payload.data.documentId),
          tx
        )
        await broadcastComponent(socketServer, component)

        res.json(component)
      })
    } catch (err) {
      req.log.error({ workspaceId, err }, 'Error creating reusable component')
      res.sendStatus(500)
    }
  })

  router.put('/:componentId', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const componentId = getParam(req, 'componentId')
    const payload = UpdateReusableComponent.safeParse(req.body)

    if (!payload.success) {
      res.sendStatus(400)
      return
    }

    try {
      const previousComponent = await prisma().reusableComponent.findFirst({
        where: { id: componentId },
        select: { document: { select: { workspaceId: true } } },
      })

      if (!previousComponent) {
        res.sendStatus(404)
        return
      }

      if (previousComponent.document.workspaceId !== workspaceId) {
        res.sendStatus(403)
        return
      }

      // this is very inneficient
      const component = await prisma().$transaction(async (tx) => {
        const component = await updateReusableComponent(
          componentId,
          payload.data,
          tx
        )
        const docs = await tx.document.findMany({
          where: { workspaceId },
          select: { id: true },
        })

        const queue = new PQueue({ concurrency: 3 })
        const componentBlock = decodeComponentState(component.state)
        for (const doc of docs) {
          queue.add(async () => {
            await getYDocForUpdate(
              getDocId(doc.id, null),
              socketServer,
              doc.id,
              workspaceId,
              async (ydoc) => {
                const blocks = Array.from(ydoc.blocks.values()).filter((b) =>
                  switchBlockType(b, {
                    onSQL: (block) =>
                      block.getAttribute('componentId') === component.id,
                    onPython: (block) =>
                      block.getAttribute('componentId') === component.id,
                    onRichText: () => false,
                    onVisualization: () => false,
                    onInput: () => false,
                    onDropdownInput: () => false,
                    onDateInput: () => false,
                    onFileUpload: () => false,
                    onDashboardHeader: () => false,
                    onWriteback: () => false,
                    onPivotTable: () => false,
                  })
                )

                for (const block of blocks) {
                  const success = updateBlockFromComponent(
                    componentBlock,
                    block,
                    ydoc.blocks
                  )
                  if (!success) {
                    logger().error(
                      {
                        workspaceId,
                        blockId: block.getAttribute('id'),
                        blockType: block.getAttribute('type'),
                        componentId,
                        componentType: component.type,
                      },
                      'Could not update block from component'
                    )
                  }
                }
              },
              new DocumentPersistor(doc.id),
              tx
            )
          })
        }

        await queue.onIdle()

        return component
      })

      await broadcastComponent(socketServer, component)
      res.json(component)
    } catch (err) {
      req.log.error(
        { workspaceId, componentId, err },
        'Error updating reusable component'
      )
      res.sendStatus(500)
    }
  })

  router.delete('/:componentId', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const componentId = getParam(req, 'componentId')

    try {
      const component = await prisma().reusableComponent.findFirst({
        where: { id: componentId },
        select: { document: { select: { workspaceId: true } } },
      })

      if (!component) {
        res.sendStatus(404)
        return
      }

      if (component.document.workspaceId !== workspaceId) {
        res.sendStatus(403)
        return
      }

      await prisma().reusableComponent.delete({ where: { id: componentId } })
      await broadcastComponentRemoved(socketServer, workspaceId, componentId)

      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        { workspaceId, componentId, err },
        'Error deleting reusable component'
      )
      res.sendStatus(500)
    }
  })

  return router
}
