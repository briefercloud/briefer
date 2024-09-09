import http from 'http'
import config from '../config/index.js'
import { sessionFromCookies } from '../auth/token.js'
import cookie from 'cookie'
import { Socket as BaseSocket, Server as BaseServer } from 'socket.io'
import { ApiDocument, EnvironmentStatus } from '@briefer/database'
import { PythonCompletionMessage } from '@briefer/types'
import { v4 as uuidv4 } from 'uuid'
import { logger } from '../logger.js'
import { joinWorkspace, leaveWorkspace } from './workspace/index.js'
import {
  handleGetEnvironmentStatus,
  handleRestartEnvironment,
} from './workspace/environment.js'
import { Session } from '../types.js'
import completePython from './complete-python.js'

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
      next(new Error('Internal Server Error'))
    }
  })

  let workInProgress: Map<string, Promise<void>> = new Map()

  io.on('connection', (socket: Socket) => {
    const session = socket.session
    if (!session) {
      socket.disconnect(true)
      return
    }

    const trackWork =
      (fn: (data: unknown) => Promise<void>) => async (data: unknown) => {
        const id = uuidv4()
        try {
          const promise = fn(data)
          workInProgress.set(id, promise)
          await promise
        } finally {
          workInProgress.delete(id)
        }
      }

    socket.on('join-workspace', trackWork(joinWorkspace(socket, session)))
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
  })

  return {
    io: io,
    shutdown: async () => {
      try {
        logger.info('Shutting down socket server')
        while (workInProgress.size > 0) {
          logger.info(
            { workInProgress: workInProgress.size },
            'Waiting for work to finish'
          )

          for (const p of workInProgress.values()) {
            await p
          }
        }

        logger.info('All socket server work finished')
      } catch (err) {
        logger.error({ err }, 'Error shutting down socket server')
        throw err
      }
    },
  }
}
