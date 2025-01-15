import { IOServer, Socket } from './index.js'
import { Session } from '../types.js'
import { z } from 'zod'
import { logger } from '../logger.js'
import { DocumentPersistor } from '../yjs/v2/persistors.js'
import { PythonSuggestion, PythonSuggestionsResult } from '@briefer/types'
import { getDocumentSourceWithBlockStartPos } from '@briefer/editor'
import { getCompletion } from '../python/index.js'
import { getDocId, getYDocForUpdate } from '../yjs/v2/index.js'
import { isAuthorizedForDocument } from '../auth/token.js'

const completPython =
  (io: IOServer, socket: Socket, { user, userWorkspaces }: Session) =>
  async (data: unknown, ack: (result: PythonSuggestionsResult) => void) => {
    const parsedData = z
      .object({
        documentId: z.string(),
        blockId: z.string(),
        position: z.number(),
      })
      .safeParse(data)
    if (!parsedData.success) {
      ack({
        status: 'invalid-payload',
      })
      return
    }

    const { blockId, documentId, position } = parsedData.data

    const doc = await isAuthorizedForDocument(documentId, user.id)
    const role = doc ? userWorkspaces[doc.workspaceId]?.role : null
    if (!doc || !role || role === 'viewer') {
      socket.disconnect(true)
      return
    }

    try {
      const id = getDocId(documentId, null)
      await getYDocForUpdate(
        id,
        io,
        doc.id,
        doc.workspaceId,
        async (yDoc) => {
          const { source, blockStartPos } = getDocumentSourceWithBlockStartPos(
            yDoc.ydoc,
            blockId
          )
          const finalPosition = blockStartPos + position

          const completion = await getCompletion(
            doc.workspaceId,
            doc.id,
            source,
            finalPosition
          )

          if (completion.content.status === 'abort') {
            ack({
              status: 'success',
              suggestions: [],
            })
            return
          }
          if (completion.content.status === 'error') {
            logger().error(
              {
                documentId,
                blockId,
                ename: completion.content.ename,
                evalue: completion.content.evalue,
                traceback: completion.content.traceback,
              },
              'Python completion error'
            )
            ack({
              status: 'unexpected-error',
            })
            return
          }

          const suggestions: PythonSuggestion[] = []

          const matches = new Set(completion.content.matches)
          const metadata = z
            .object({
              _jupyter_types_experimental: z.array(z.record(z.unknown())),
            })
            .safeParse(completion.content.metadata)

          if (metadata.success) {
            const rawSuggestions = metadata.data._jupyter_types_experimental
            for (const rawSuggestion of rawSuggestions) {
              const parsed = PythonSuggestion.safeParse(rawSuggestion)
              if (parsed.success) {
                suggestions.push(parsed.data)
                matches.delete(parsed.data.text)
              } else {
                logger().error(
                  {
                    documentId,
                    blockId,
                    jupyterType: rawSuggestion,
                    error: parsed.error,
                  },
                  'Failed to parse jupyter type'
                )
              }
            }
          }

          for (const match of matches) {
            suggestions.push({
              start: completion.content.cursor_start,
              end: completion.content.cursor_end,
              text: match,
              type: 'text',
              signature: '',
            })
          }

          ack({
            status: 'success',
            suggestions,
          })
        },
        new DocumentPersistor(id, documentId)
      )
    } catch (err) {
      logger().error(
        {
          documentId,
          blockId,
          err,
        },
        'Failed to get python completion'
      )
      ack({
        status: 'unexpected-error',
      })
    }
  }

export default completPython
