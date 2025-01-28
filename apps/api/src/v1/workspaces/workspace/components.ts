import { Router } from 'express'
import prisma, {
  APIReusableComponent,
  createReusableComponent,
  NewReusableComponent,
  ReusableComponentInstance,
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
  getBaseAttributes,
  switchBlockType,
  updateBlockFromComponent,
} from '@briefer/editor'
import PQueue from 'p-queue'
import { logger } from '../../../logger.js'
import { uuidSchema } from '@briefer/types'
import { z } from 'zod'

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

      const component = await createReusableComponent(payload.data)
      const docId = getDocId(payload.data.documentId, null)
      await getYDocForUpdate(
        docId,
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
            onVisualizationV2: () => {},
            onInput: () => {},
            onDropdownInput: () => {},
            onDateInput: () => {},
            onFileUpload: () => {},
            onDashboardHeader: () => {},
            onWriteback: () => {},
            onPivotTable: () => {},
          })
        },
        new DocumentPersistor(docId, payload.data.documentId)
      )
      await broadcastComponent(socketServer, component)

      res.json(component)
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
        select: {
          document: { select: { workspaceId: true } },
          reusableComponentInstances: true,
        },
      })

      if (!previousComponent) {
        res.sendStatus(404)
        return
      }

      if (previousComponent.document.workspaceId !== workspaceId) {
        res.sendStatus(403)
        return
      }

      const component = await updateReusableComponent(componentId, payload.data)

      if (!component.instancesCreated) {
        // this is very inneficient
        const docs = await prisma().document.findMany({
          where: { workspaceId },
          select: { id: true },
        })

        await updateReusableComponentInstanceOld(
          workspaceId,
          component,
          docs,
          socketServer
        )

        await prisma().reusableComponent.update({
          where: { id: componentId },
          data: { instancesCreated: true },
        })
        component.instancesCreated = true
      } else {
        await updateReusableComponentInstance(
          workspaceId,
          component,
          socketServer,
          previousComponent.reusableComponentInstances
        )
      }

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

  router.post('/:componentId/instances/', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const componentId = getParam(req, 'componentId')
    const payload = z
      .object({
        documentId: uuidSchema,
        blockId: uuidSchema,
      })
      .safeParse(req.body)

    if (!payload.success) {
      res.sendStatus(400)
      return
    }

    try {
      await prisma().reusableComponentInstance.create({
        data: {
          reusableComponentId: componentId,
          blockId: payload.data.blockId,
          documentId: payload.data.documentId,
        },
      })
      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        { workspaceId, componentId, err },
        'Error creating reusable component instance'
      )
      res.sendStatus(500)
    }
  })

  router.delete('/:componentId/instances/:blockId', async (req, res) => {
    const workspaceId = getParam(req, 'workspaceId')
    const componentId = getParam(req, 'componentId')
    const blockId = getParam(req, 'blockId')

    try {
      const deleted = await prisma().reusableComponentInstance.deleteMany({
        where: { blockId },
      })
      if (deleted.count === 0) {
        res.sendStatus(404)
        return
      }

      res.sendStatus(204)
    } catch (err) {
      req.log.error(
        { workspaceId, componentId, blockId, err },
        'Error deleting reusable component instance'
      )
      res.sendStatus(500)
    }
  })

  return router
}

async function updateReusableComponentInstanceOld(
  workspaceId: string,
  component: APIReusableComponent,
  docs: { id: string }[],
  socketServer: IOServer
): Promise<void> {
  const queue = new PQueue({ concurrency: 3 })
  const componentBlock = decodeComponentState(component.state)
  for (const doc of docs) {
    queue.add(async () => {
      const docId = getDocId(doc.id, null)
      await getYDocForUpdate(
        docId,
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
              onVisualizationV2: () => false,
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
            const blockId = getBaseAttributes(block).id
            const success = updateBlockFromComponent(
              componentBlock,
              block,
              ydoc.blocks
            )
            if (success) {
              await prisma().reusableComponentInstance.upsert({
                where: {
                  blockId,
                  documentId: doc.id,
                  reusableComponentId: component.id,
                },
                create: {
                  blockId,
                  documentId: doc.id,
                  reusableComponentId: component.id,
                },
                update: {},
              })
            } else {
              logger().error(
                {
                  workspaceId,
                  blockId: block.getAttribute('id'),
                  blockType: block.getAttribute('type'),
                  componentId: component.id,
                  componentType: component.type,
                },
                'Could not update block from component'
              )
            }
          }
        },
        new DocumentPersistor(docId, doc.id)
      )
    })
  }

  await queue.onIdle()
}

async function updateReusableComponentInstance(
  workspaceId: string,
  component: APIReusableComponent,
  socketServer: IOServer,
  reusableComponentInstances: ReusableComponentInstance[]
): Promise<void> {
  const queue = new PQueue({ concurrency: 3 })
  const componentBlock = decodeComponentState(component.state)
  const byDocument = new Map<string, ReusableComponentInstance[]>()
  for (const instance of reusableComponentInstances) {
    const instances = byDocument.get(instance.documentId)
    if (!instances) {
      byDocument.set(instance.documentId, [instance])
    } else {
      instances.push(instance)
    }
  }

  Array.from(byDocument.entries()).forEach(([documentId, instances]) => {
    queue.add(async () => {
      const docId = getDocId(documentId, null)

      await getYDocForUpdate(
        docId,
        socketServer,
        documentId,
        workspaceId,
        async (ydoc) => {
          for (const instance of instances) {
            const block = ydoc.blocks.get(instance.blockId)
            if (!block) {
              logger().warn(
                {
                  workspaceId,
                  componentId: component.id,
                  documentId,
                  blockId: instance.blockId,
                },
                'Could not find block for reusable component instance'
              )
              continue
            }
            const success = updateBlockFromComponent(
              componentBlock,
              block,
              ydoc.blocks
            )
            if (!success) {
              logger().error(
                {
                  workspaceId,
                  documentId,
                  blockId: instance.blockId,
                  blockType: block.getAttribute('type'),
                  componentId: component.id,
                  componentType: component.type,
                },
                'Could not update block from component'
              )
            }
          }
        },
        new DocumentPersistor(docId, documentId)
      )
    })
  })

  await queue.onIdle()
}
