import { z } from 'zod'
import { CookieOptions } from 'express'
import config from '../config/index.js'
import parseDuration from 'parse-duration'
import { IOServer } from '../websocket/index.js'
import getBaseRouter from './base.js'

const JWT_EXPIRATION_MS = parseDuration(config().AUTH_JWT_EXPIRATION)

export const callbackUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((url) => new URL(url).origin === config().FRONTEND_URL)

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: config().NODE_ENV === 'production' && !config().ALLOW_HTTP,
  sameSite: 'strict',
  maxAge: JWT_EXPIRATION_MS,
}

export default function authRouter(socketServer: IOServer) {
  const cfg = config()

  return getBaseRouter(socketServer, cfg)
}
