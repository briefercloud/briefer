import * as yjsDocsV2 from './yjs/v2/documents.js'
import * as dfns from 'date-fns'
import { PrismaTransaction, Document } from '@briefer/database'
import PQueue from 'p-queue'
import { IOServer } from './websocket/index.js'

const queues = new Map<string, PQueue>()
async function wrapInQueue<T>(
  workspaceId: string,
  fn: () => Promise<T>
): Promise<T> {
  const queue = queues.get(workspaceId) ?? new PQueue({ concurrency: 1 })
  queues.set(workspaceId, queue)

  return (await queue.add(fn))!
}

export async function upsertDocument(
  id: string,
  title: string,
  workspaceId: string,
  parentId: string | null,
  orderIndex: number,
  version: number,
  tx: PrismaTransaction
): Promise<{ created: boolean; document: Document }> {
  return wrapInQueue(workspaceId, async () => {
    // Determine the correct orderIndex
    const childrenCount = await tx.document.count({
      where: {
        workspaceId,
        parentId,
        deletedAt: null,
      },
    })
    const lastChildIndex = await tx.document.findFirst({
      where: {
        workspaceId,
        parentId,
        deletedAt: null,
      },
      orderBy: {
        orderIndex: 'desc',
      },
      select: {
        orderIndex: true,
      },
    })
    const finalOrderIndex =
      orderIndex === -1 || orderIndex > childrenCount
        ? (lastChildIndex?.orderIndex ?? childrenCount - 1) + 1
        : orderIndex

    // Adjust orderIndex for existing documents if inserting a new document
    await tx.document.updateMany({
      where: {
        workspaceId,
        parentId,
        orderIndex: { gte: finalOrderIndex },
      },
      data: {
        orderIndex: {
          increment: 1,
        },
      },
    })

    // Use Prisma's upsert to either update an existing document or insert a new one
    const document = await tx.document.upsert({
      where: { id, workspaceId },
      update: {
        title,
        workspaceId,
        parentId,
        orderIndex: finalOrderIndex,
      },
      create: {
        id,
        title,
        workspaceId,
        parentId,
        orderIndex: finalOrderIndex,
        version,
      },
    })

    return {
      created: dfns.isEqual(document.createdAt, document.updatedAt),
      document,
    }
  })
}

export async function moveDocument(
  id: string,
  workspaceId: string,
  newParentId: string | null,
  newOrderIndex: number,
  tx: PrismaTransaction
): Promise<Document> {
  return wrapInQueue(workspaceId, async () => {
    const documentToUpdate = await tx.document.findUniqueOrThrow({
      where: { id, workspaceId },
    })

    // If newOrderIndex is -1 or greater than the number of children, set it to the number of children
    const childrenCount = await tx.document.count({
      where: {
        workspaceId,
        parentId: newParentId,
        deletedAt: null,
      },
    })
    if (newOrderIndex === -1 || newOrderIndex > childrenCount) {
      newOrderIndex = childrenCount
    }

    // Make space in the new location
    await tx.document.updateMany({
      where: {
        workspaceId,
        parentId: newParentId,
        orderIndex: { gte: newOrderIndex },
      },
      data: {
        orderIndex: {
          increment: 1,
        },
      },
    })

    // Update the document's parent and orderIndex
    const document = await tx.document.update({
      where: { id, workspaceId },
      data: {
        workspaceId,
        parentId: newParentId,
        orderIndex: newOrderIndex,
      },
    })

    // Close the gap left in the old location, if the parent changed or the document moved forward
    if (
      documentToUpdate.parentId !== newParentId ||
      documentToUpdate.orderIndex > newOrderIndex
    ) {
      await tx.document.updateMany({
        where: {
          workspaceId,
          parentId: documentToUpdate.parentId,
          orderIndex: { gt: documentToUpdate.orderIndex },
        },
        data: {
          orderIndex: {
            decrement: 1,
          },
        },
      })
    }

    return document
  })
}

async function restoreChildren(
  parentId: string,
  workspaceId: string,
  tx: PrismaTransaction
) {
  await tx.document.updateMany({
    where: {
      parentId,
      workspaceId,
    },
    data: { deletedAt: null },
  })

  const children = await tx.document.findMany({
    where: {
      parentId: parentId,
      workspaceId,
    },
    select: { id: true },
  })
  for (const child of children) {
    await restoreChildren(child.id, workspaceId, tx)
  }
}

export async function restoreDocument(
  id: string,
  workspaceId: string,
  tx: PrismaTransaction
): Promise<Document> {
  return wrapInQueue(workspaceId, async () => {
    const documentToRestore = await tx.document.findUniqueOrThrow({
      where: { id, workspaceId, deletedAt: { not: null } },
      include: { parent: true },
    })

    let parent = documentToRestore.parent
    if (parent && parent.deletedAt) {
      // if the parent is deleted, we assigned it to the root
      parent = null
    }

    // Find the max orderIndex among the siblings to restore the document as the last child
    const maxOrderIndex = await tx.document.aggregate({
      where: {
        workspaceId,
        parentId: parent?.id ?? null,
        deletedAt: null, // Consider only non-deleted documents
      },
      _max: {
        orderIndex: true,
      },
    })

    const newOrderIndex = (maxOrderIndex._max.orderIndex ?? 0) + 1

    // Restore the document
    const document = await tx.document.update({
      where: { id, workspaceId },
      data: {
        parentId: parent?.id ?? null,
        deletedAt: null,
        orderIndex: newOrderIndex,
      },
    })

    await restoreChildren(document.id, workspaceId, tx)

    return document
  })
}

async function softDeleteChildren(
  parentId: string,
  workspaceId: string,
  deletedAt: Date,
  tx: PrismaTransaction
) {
  await tx.document.updateMany({
    where: {
      parentId: parentId,
      workspaceId,
    },
    data: { deletedAt },
  })

  const children = await tx.document.findMany({
    where: {
      parentId: parentId,
      workspaceId,
    },
    select: { id: true },
  })
  for (const child of children) {
    await softDeleteChildren(child.id, workspaceId, deletedAt, tx)
  }
}

export async function deleteDocument(
  id: string,
  workspaceId: string,
  softDelete: boolean,
  tx: PrismaTransaction
): Promise<Document> {
  return wrapInQueue(workspaceId, async () => {
    if (!softDelete) {
      const document = await tx.document.findUniqueOrThrow({
        where: { id, workspaceId },
      })
      if (!document.deletedAt) {
        // if this document is not soft deleted we need to decrement
        // the orderIndex of the siblings first
        await tx.document.updateMany({
          where: {
            parentId: document.parentId,
            orderIndex: { gt: document.orderIndex },
            workspaceId,
          },
          data: {
            orderIndex: {
              decrement: 1,
            },
          },
        })
      }

      // Hard delete the document
      return tx.document.delete({
        where: { id, workspaceId },
      })
    }

    const deletedAt = new Date()
    const document = await tx.document.update({
      where: { id, workspaceId },
      data: { deletedAt },
    })
    await softDeleteChildren(id, workspaceId, deletedAt, tx)

    await tx.document.updateMany({
      where: {
        parentId: document.parentId,
        orderIndex: { gt: document.orderIndex },
        workspaceId,
      },
      data: {
        orderIndex: {
          decrement: 1,
        },
      },
    })

    return document
  })
}

function getDuplicatedTitle(prevTitle: string) {
  return prevTitle === '' ? '' : `${prevTitle} copy`
}

export async function duplicateDocument(
  id: string,
  workspaceId: string,
  socketServer: IOServer,
  tx: PrismaTransaction
): Promise<Document> {
  return wrapInQueue(workspaceId, async () => {
    const documentToDuplicate = await tx.document.findUniqueOrThrow({
      where: { id, workspaceId },
    })

    // Duplicate the document and its children recursively
    const orderIndex = documentToDuplicate.orderIndex + 1

    // Increment orderIndex for existing documents to make space for the duplicated one
    await tx.document.updateMany({
      where: {
        parentId: documentToDuplicate.parentId,
        workspaceId,
        orderIndex: { gte: orderIndex },
      },
      data: {
        orderIndex: {
          increment: 1,
        },
      },
    })

    const duplicatedTitle = getDuplicatedTitle(documentToDuplicate.title)
    const duplicatedDocument = await tx.document.create({
      data: {
        title: duplicatedTitle,
        workspaceId: workspaceId,
        parentId: documentToDuplicate.parentId,
        version: documentToDuplicate.version,
        orderIndex,
        icon: documentToDuplicate.icon,
      },
    })

    const parentsToDuplicateChildren: { old: Document; new: Document }[] = [
      { old: documentToDuplicate, new: duplicatedDocument },
    ]
    let currentParent = parentsToDuplicateChildren.pop()
    while (currentParent) {
      const children = await tx.document.findMany({
        where: {
          parentId: currentParent.old.id,
          workspaceId,
        },
      })

      const childrenIdsMap = new Map<string, { id: string; title: string }>()
      for (const child of children) {
        const duplicatedChild = await tx.document.create({
          data: {
            title: child.title,
            workspaceId: child.workspaceId,
            parentId: currentParent.new.id,
            orderIndex: child.orderIndex,
            version: child.version,
          },
        })
        childrenIdsMap.set(child.id, {
          id: duplicatedChild.id,
          title: duplicatedChild.title,
        })
        parentsToDuplicateChildren.push({ old: child, new: duplicatedChild })
      }

      await yjsDocsV2.duplicateDocument(
        socketServer,
        currentParent.old,
        currentParent.new,
        getDuplicatedTitle,
        tx
      )

      currentParent = parentsToDuplicateChildren.pop()
    }

    return duplicatedDocument
  })
}
