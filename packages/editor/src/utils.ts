import { validate as validateUUID } from 'uuid'
import * as z from 'zod'

export function exhaustiveCheck(_param: never) {}

export const uuidSchema = z.string().refine((uuid) => validateUUID(uuid), {
  message: 'Invalid UUID format',
})
