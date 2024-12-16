import { createDocument, getDocument, listDocuments } from '@briefer/database'
import { IOServer, Socket } from '../index.js'

export async function emitDocuments(socket: Socket, workspaceId: string) {
  let documents = await listDocuments(workspaceId)
  if (documents.length === 0) {
    await createDocument(workspaceId, {
      orderIndex: 0,
      version: 2,
    })
    documents = await listDocuments(workspaceId)
  }

  socket.emit('workspace-documents', { workspaceId, documents })
}

export async function broadcastDocuments(
  socket: IOServer,
  workspaceId: string
) {
  const documents = await listDocuments(workspaceId)

  socket.to(workspaceId).emit('workspace-documents', { workspaceId, documents })
}

export async function broadcastDocument(
  socket: IOServer,
  workspaceId: string,
  documentId: string
) {
  const document = await getDocument(documentId)
  if (!document) {
    return
  }

  socket
    .to(workspaceId)
    .emit('workspace-document-update', { workspaceId, document })
}
