import { splitEvery } from 'ramda'
import { Document } from '@prisma/client'

import prisma, { PrismaTransaction } from './index.js'

export type ApiDocument = Document & {
  publishedAt: string | null
  clock: number
  appClock: number
  appId: string
  userAppClock: Record<string, number>
  hasDashboard: boolean
}
export type ApiDeletedDocument = ApiDocument & {
  deletedAt: Date
}

export async function getDocument(
  id: string,
  tx?: PrismaTransaction
): Promise<ApiDocument | null> {
  const doc = await (tx ?? prisma()).document.findUnique({
    where: { id },
    include: {
      yjsDocument: {
        select: {
          clock: true,
        },
      },
      yjsAppDocuments: {
        select: {
          id: true,
          createdAt: true,
          clock: true,
          hasDashboard: true,
          userYjsAppDocuments: {
            select: {
              userId: true,
              clock: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  })

  return doc
    ? {
        ...doc,
        clock: doc.yjsDocument?.clock ?? 0,
        publishedAt: doc.yjsAppDocuments[0]?.createdAt.toISOString() ?? null,
        appId: doc.yjsAppDocuments[0]?.id ?? '',
        appClock: doc.yjsAppDocuments[0]?.clock ?? 0,
        userAppClock:
          doc.yjsAppDocuments[0]?.userYjsAppDocuments.reduce((acc, userDoc) => {
            acc[userDoc.userId] = userDoc.clock
            return acc
          }, {} as Record<string, number>) ?? {},
        hasDashboard: doc.yjsAppDocuments[0]?.hasDashboard ?? false,
      }
    : null
}

export async function toApiDocument(doc: Document): Promise<ApiDocument> {
  const apiDoc = await getDocument(doc.id)
  if (!apiDoc) {
    throw new Error(`Document ${doc.id} not found`)
  }

  return apiDoc
}

export async function listDocuments(
  workspaceId: string
): Promise<ApiDocument[]> {
  const docs = await prisma().document.findMany({
    where: {
      workspaceId,
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      yjsDocument: {
        select: {
          clock: true,
        },
      },
      yjsAppDocuments: {
        select: {
          id: true,
          clock: true,
          createdAt: true,
          hasDashboard: true,
          userYjsAppDocuments: {
            select: {
              userId: true,
              clock: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
      },
    },
  })

  return docs.map((doc) => ({
    ...doc,
    publishedAt: doc.yjsAppDocuments[0]?.createdAt.toISOString() ?? null,
    appId: doc.yjsAppDocuments[0]?.id ?? '',
    clock: doc.yjsDocument?.clock ?? 0,
    appClock: doc.yjsAppDocuments[0]?.clock ?? 0,
    userAppClock:
      doc.yjsAppDocuments[0]?.userYjsAppDocuments.reduce((acc, userDoc) => {
        acc[userDoc.userId] = userDoc.clock
        return acc
      }, {} as Record<string, number>) ?? {},
    hasDashboard: doc.yjsAppDocuments[0]?.hasDashboard ?? false,
  }))
}

export async function updateDocument(
  id: string,
  data: Partial<Pick<Document, 'title'>>,
  tx?: PrismaTransaction
): Promise<Document> {
  return (tx ?? prisma()).document.update({
    where: { id },
    data,
  })
}

export async function restoreDocument(
  id: string,
  workspaceId: string,
  tx?: PrismaTransaction
) {
  return (tx ?? prisma()).document.update({
    where: { id, workspaceId },
    data: { deletedAt: null },
  })
}

export async function restoreDocumentAndChildren(
  documentId: string,
  workspaceId: string,
  tx?: PrismaTransaction
) {
  const allChildren: string[] = []
  const queue = allChildren.slice()
  let current = queue.shift()
  let first = true
  while (current || first) {
    first = false
    const children = (
      await prisma().document.findMany({
        where: {
          parentId: current,
        },
        select: {
          id: true,
        },
      })
    ).map((c) => c.id)
    queue.push(...children)
    current = queue.shift()
  }

  const allDocs = [documentId, ...allChildren]

  const recover = async (tx: PrismaTransaction) => {
    for (const chunk of splitEvery(1000, allDocs)) {
      await tx.document.updateMany({
        where: {
          id: {
            in: chunk,
          },
          workspaceId,
        },
        data: {
          deletedAt: null,
        },
      })
    }
  }

  if (tx) {
    return recover(tx)
  }

  return prisma().$transaction(recover)
}

export async function createDocument(
  workspaceId: string,
  data: {
    id?: string
    title?: string
    icon?: string
    parentId?: string | null
    version?: number
    orderIndex: number
  },
  tx?: PrismaTransaction
): Promise<Document> {
  if (data.parentId) {
    const parent = await (tx ?? prisma()).document.findUnique({
      where: { id: data.parentId, workspaceId },
    })

    if (!parent) {
      throw new Error('Parent document not found in workspace')
    }
  }

  return (tx ?? prisma()).document.create({
    data: {
      id: data.id,
      parentId: data.parentId,
      workspaceId,
      title: data.title ?? '',
      orderIndex: data.orderIndex,
      version: data.version,
      icon: data.icon,
    },
  })
}

export async function deleteDocument(
  id: string,
  isPermanent: boolean,
  tx?: PrismaTransaction
): Promise<Document | null> {
  async function softDelete(tx: PrismaTransaction) {
    const document = await tx.document.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    await tx.favorite.deleteMany({
      where: {
        documentId: id,
      },
    })

    return document
  }

  if (isPermanent) {
    return (tx ?? prisma()).document.delete({
      where: { id },
    })
  }

  if (tx) {
    return softDelete(tx)
  }

  return prisma().$transaction(softDelete)
}

// we can do better using a recursive CTE but then we cannot use
// prisma query builder, this is good enough for now
export async function deleteDocumentAndChildren(
  documentId: string,
  isPermanent: boolean,
  tx?: PrismaTransaction
) {
  async function run(tx: PrismaTransaction) {
    const doc = await deleteDocument(documentId, isPermanent, tx)
    if (!doc) {
      return null
    }

    // if we are deleting permanently, children get's deleted
    // automatically by the database
    if (isPermanent) {
      return doc
    }

    const children = await tx.document.findMany({
      where: {
        parentId: documentId,
      },
    })

    for (const child of children) {
      await deleteDocumentAndChildren(child.id, isPermanent, tx)
    }

    return doc
  }

  return tx
    ? run(tx)
    : prisma().$transaction(run, { maxWait: 31000, timeout: 30000 })
}

export const createFavorite = async (userId: string, documentId: string) => {
  return prisma().favorite.create({
    data: {
      userId,
      documentId,
    },
  })
}

export const deleteFavorite = async (userId: string, documentId: string) => {
  return prisma().favorite.deleteMany({
    where: {
      userId,
      documentId,
    },
  })
}

export const setIcon = async (
  documentId: string,
  icon: string,
  tx?: PrismaTransaction
) => {
  return (tx ?? prisma()).document.update({
    where: { id: documentId },
    data: { icon },
  })
}
