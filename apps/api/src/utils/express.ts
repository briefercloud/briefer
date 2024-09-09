import { z } from 'zod'
import { Request } from 'express'

export function getParam(req: Request, name: string): string {
  return z.object({ [name]: z.string().min(1) }).parse(req.params)[name]!
}
