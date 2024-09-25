import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { Request, Response, NextFunction } from 'express'
import {
  prisma,
  Document,
  DataSource,
  UserWorkspaceRole,
  UserWorkspace,
} from '@briefer/database'
import { validate } from 'uuid'
import { logger } from '../logger.js'
import { getParam } from '../utils/express.js'
import { Session } from '../types.js'
import { config } from '../config/index.js'

function signToken(data: object, secret: string, expiresIn: string | number) {
  return jwt.sign(data, secret, {
    expiresIn,
  })
}

export function verifyToken<T>(
  token: string,
  decoder: z.ZodType<T>,
  secret: string
): { data?: T; isExpired: boolean } {
  try {
    const decoded = decoder.safeParse(jwt.decode(token))

    let isExpired = false
    try {
      jwt.verify(token, secret)
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        isExpired = true
      } else {
        logger().error({ err }, 'Error verifying token')
        throw err
      }
    }

    if (decoded.success) {
      return { data: decoded.data, isExpired }
    }

    return { data: undefined, isExpired }
  } catch (err) {
    logger().error({ err }, 'Error decoding token')
    return { data: undefined, isExpired: false }
  }
}

export function createLoginLink(userId: string, callback: string): string {
  const token = signToken(
    { userId, callback },
    config().LOGIN_JWT_SECRET,
    config().LOGIN_LINK_EXPIRATION
  )
  const link = `${config().API_URL}/auth/link/callback?t=${token}`

  return link
}

export function decodeLoginToken(token: string) {
  return verifyToken(
    token,
    z.object({ userId: z.string().min(1), callback: z.string().min(1) }),
    config().LOGIN_JWT_SECRET
  )
}

export function createAuthToken(userId: string, expiration?: string): string {
  return signToken(
    { userId },
    config().AUTH_JWT_SECRET,
    expiration ?? config().AUTH_JWT_EXPIRATION
  )
}

export function decodeAuthToken(token: string) {
  return verifyToken(
    token,
    z.object({ userId: z.string().min(1) }),
    config().AUTH_JWT_SECRET
  )
}

export async function sessionFromCookies(
  cookies: Record<string, string>
): Promise<Session | null> {
  const token = cookies['token']
  if (!token) {
    return null
  }

  const { data, isExpired } = decodeAuthToken(token)
  if (!data) {
    return null
  }

  if (isExpired) {
    return null
  }

  const user = await prisma().user.findUnique({
    where: { id: data.userId },
    select: {
      id: true,
      email: true,
      name: true,
      picture: true,
      createdAt: true,
      updatedAt: true,
      workspaces: true,
    },
  })
  if (!user) {
    return null
  }

  const userWorkspaces: Record<string, UserWorkspace> = {}
  for (const uw of user.workspaces) {
    userWorkspaces[uw.workspaceId] = uw
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    userWorkspaces,
  }
}

export async function authenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const session = await sessionFromCookies(req.cookies)
    if (!session) {
      res.status(401).end()
      return
    }

    req.session = session

    next()
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError) {
      res.status(403).send('Invalid token')
      return
    }

    req.log.error({ err }, 'Error verifying token')
    res.status(500).end()
  }
}

export function hasWorkspaceRoles(roles: UserWorkspaceRole[]) {
  const rolesSet = new Set(roles)

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const workspaceId = getParam(req, 'workspaceId')
      const userWorkspace = req.session.userWorkspaces[workspaceId]
      if (!userWorkspace) {
        res.status(403).end()
        return
      }

      if (!rolesSet.has(userWorkspace.role)) {
        res.status(403).end()
        return
      }

      next()
    } catch (err) {
      req.log.error({ err }, 'Error verifying workspace roles')
      res.status(500).end()
    }
  }
}

export function canUpdateWorkspace(
  req: Request,
  res: Response,
  next: NextFunction
) {
  hasWorkspaceRoles([UserWorkspaceRole.admin, UserWorkspaceRole.editor])(
    req,
    res,
    next
  )
}

export async function canReadDocument(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const documentId = getParam(req, 'documentId')
    if (!validate(documentId)) {
      res.status(400).end()
      return
    }

    const result = await isAuthorizedForDocument(
      documentId,
      req.session.user.id
    )
    if (!result) {
      res.status(403).end()
      return
    }

    next()
  } catch (err) {
    req.log.error({ err }, 'Error verifying document access')
    res.status(500).end()
  }
}

export const isAuthorizedForDocument = async (
  documentId: string,
  userId: string
): Promise<Document | null> => {
  if (!validate(documentId) || !validate(userId)) {
    return null
  }

  const result = await prisma().document.findFirst({
    where: {
      id: documentId,
      workspace: {
        users: {
          some: {
            userId: userId,
          },
        },
      },
    },
  })

  if (!result) {
    return null
  }

  return result
}

export const isAuthorizedForDataSource = async (
  dataSourceId: string,
  dataSourceType: DataSource['type'],
  userId: string
): Promise<boolean> => {
  if (!validate(dataSourceId) || !validate(userId)) {
    return false
  }

  const query = {
    where: {
      id: dataSourceId,
      workspace: {
        users: {
          some: {
            userId: userId,
          },
        },
      },
    },
    select: {
      id: true,
    },
  }

  switch (dataSourceType) {
    case 'redshift': {
      const result = await prisma().redshiftDataSource.findFirst(query)
      return result !== null
    }
    case 'bigquery': {
      const result = await prisma().bigQueryDataSource.findFirst(query)
      return result !== null
    }
    case 'psql': {
      const result = await prisma().postgreSQLDataSource.findFirst(query)
      return result !== null
    }
    case 'athena': {
      const result = await prisma().athenaDataSource.findFirst(query)
      return result !== null
    }
    case 'oracle': {
      const result = await prisma().oracleDataSource.findFirst(query)
      return result !== null
    }
    case 'mysql': {
      const result = await prisma().mySQLDataSource.findFirst(query)
      return result !== null
    }
    case 'trino': {
      const result = await prisma().trinoDataSource.findFirst(query)
      return result !== null
    }
    case 'snowflake': {
      const result = await prisma().snowflakeDataSource.findFirst(query)
      return result !== null
    }
  }
}
