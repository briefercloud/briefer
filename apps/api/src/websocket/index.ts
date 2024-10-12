import http from 'http'
import { config } from '../config/index.js'
import { sessionFromCookies } from '../auth/token.js'
import cookie from 'cookie'
import { Socket as BaseSocket, Server as BaseServer } from 'socket.io'
import {
  APIDataSource,
  ApiDocument,
  APIReusableComponent,
  EnvironmentStatus,
} from '@briefer/database'
import { PythonCompletionMessage, Comment } from '@briefer/types'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../logger.js'
import { joinWorkspace, leaveWorkspace } from './workspace/index.js'
import {
  handleGetEnvironmentStatus,
  handleRestartEnvironment,
} from './workspace/environment.js'
import { Session } from '../types.js'
import completePython from './complete-python.js'
import {
  refreshDataSource,
  refreshDataSources,
} from './workspace/data-sources.js'
import { fetchDocumentComments } from './workspace/comments.js'

interface EmitEvents {
  'environment-status-update': (msg: {
    workspaceId: string
    status: EnvironmentStatus
    startedAt: string | null
  }) => void
  'environment-status-error': (msg: {
    workspaceId: string
    error: string
  }) => void

  'workspace-error': (msg: { workspaceId: string; error: string }) => void
  'workspace-documents': (msg: {
    workspaceId: string
    documents: ApiDocument[]
  }) => void
  'workspace-document-update': (msg: {
    workspaceId: string
    document: ApiDocument
  }) => void

  'workspace-datasources': (msg: {
    workspaceId: string
    dataSources: APIDataSource[]
  }) => void
  'workspace-datasource-update': (msg: {
    workspaceId: string
    dataSource: APIDataSource
  }) => void

  'workspace-components': (msg: {
    workspaceId: string
    components: APIReusableComponent[]
  }) => void
  'workspace-component-update': (msg: {
    workspaceId: string
    component: APIReusableComponent
  }) => void
  'workspace-component-removed': (msg: {
    workspaceId: string
    componentId: string
  }) => void

  'document-comments': (msg: {
    documentId: string
    comments: Comment[]
  }) => void
  'document-comment': (msg: { documentId: string; comment: Comment }) => void
  'document-comment-deleted': (msg: {
    documentId: string
    commentId: string
  }) => void

  'python-completion': (msg: PythonCompletionMessage) => void
}

export interface Socket extends BaseSocket<any, EmitEvents> {
  session?: Session
}

export type IOServer = BaseServer<any, EmitEvents>

type Server = {
  io: IOServer
  shutdown: () => Promise<void>
}

export function createSocketServer(server: http.Server): Server {
  const io: IOServer = new BaseServer(server, {
    cors: { credentials: true, origin: config().FRONTEND_URL },
  })

  io.use(async (socket: Socket, next) => {
    try {
      const cookiesHeader = socket.handshake.headers.cookie
      const cookies = cookie.parse(cookiesHeader ?? '')

      const session = await sessionFromCookies(cookies)
      if (session) {
        socket.session = session
        next()
      } else {
        next(new Error('Unauthorized'))
      }
    } catch (err) {
      logger().error(
        {
          err,
          socketId: socket.id,
        },
        'Error authenticating socket connection'
      )
      next(new Error('Internal Server Error'))
    }
  })

  let workInProgress: Map<string, Promise<void>> = new Map()

  io.on('connection', (socket: Socket) => {
    logger().info({ socketId: socket.id }, 'Client connected to socket server')

    const session = socket.session
    if (!session) {
      logger().error(
        {
          socketId: socket.id,
        },
        'Socket connection did not have a session'
      )

      socket.disconnect(true)
      return
    }

    const trackWork =
      (fn: (data: unknown, callback?: Function) => Promise<void>) =>
      async (data: unknown, callback?: Function) => {
        const id = uuidv4()
        try {
          const promise = fn(data, callback)
          workInProgress.set(id, promise)
          await promise
        } finally {
          workInProgress.delete(id)
        }
      }

    socket.on('join-workspace', trackWork(joinWorkspace(io, socket, session)))
    socket.on('leave-workspace', trackWork(leaveWorkspace(socket, session)))

    socket.on(
      'get-environment-status',
      trackWork(handleGetEnvironmentStatus(socket, session))
    )
    socket.on(
      'restart-environment',
      trackWork(handleRestartEnvironment(socket, session))
    )
    socket.on('complete-python', trackWork(completePython(io, socket, session)))

    socket.on(
      'workspace-datasources-refresh-all',
      trackWork(refreshDataSources(io, socket, session))
    )
    socket.on(
      'workspace-datasources-refresh-one',
      trackWork(refreshDataSource(io, socket, session))
    )

    socket.on(
      'fetch-document-comments',
      trackWork(fetchDocumentComments(socket, session))
    )

    socket.on('disconnect', (reason) => {
      logger().info(
        { socketId: socket.id, reason },
        'Client disconnected from socket server'
      )
    })

    socket.on('error', (error) => {
      logger().error(
        { socketId: socket.id, error },
        'Socket server error occurred'
      )
    })
  })

  return {
    io: io,
    shutdown: async () => {
      try {
        logger().info('Shutting down socket server')
        while (workInProgress.size > 0) {
          logger().info(
            { workInProgress: workInProgress.size },
            'Waiting for work to finish'
          )

          for (const p of workInProgress.values()) {
            await p
          }
        }

        logger().info('All socket server work finished')
      } catch (err) {
        logger().error({ err }, 'Error shutting down socket server')
        throw err
      }
    },
  }
}
