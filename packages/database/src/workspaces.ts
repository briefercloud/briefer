import prisma from './index.js'

export async function getWorkspaceById(id: string) {
  return prisma().workspace.findUnique({
    where: { id },
  })
}

export async function getWorkspaceForDocument(documentId: string) {
  return prisma().workspace.findFirst({
    where: { documents: { some: { id: documentId } } },
  })
}
