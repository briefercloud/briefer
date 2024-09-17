import { ReusableComponent, ReusableComponentType } from '@prisma/client'
import prisma, { PrismaTransaction } from './index.js'
import { base64Schema, uuidSchema } from '@briefer/types'
import { z } from 'zod'

export { ReusableComponentType } from '@prisma/client'

export type APIReusableComponent = Omit<
  ReusableComponent,
  'state' | 'createdAt' | 'updatedAt'
> & {
  state: string
  createdAt: string
  updatedAt: string
  document: {
    id: string
    title: string
  }
}

export async function listReusableComponents(
  workspaceId: string
): Promise<APIReusableComponent[]> {
  const components = await prisma().reusableComponent.findMany({
    where: { document: { workspaceId } },
    include: {
      document: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })

  return components.map((component) => ({
    ...component,
    state: component.state.toString('base64'),
    createdAt: component.createdAt.toISOString(),
    updatedAt: component.updatedAt.toISOString(),
  }))
}

export const NewReusableComponent = z.object({
  id: uuidSchema.optional(),
  blockId: uuidSchema,
  documentId: uuidSchema,
  state: base64Schema,
  title: z.string(),
  type: z.union([
    z.literal(ReusableComponentType.sql),
    z.literal(ReusableComponentType.python),
  ]),
})

export type NewReusableComponent = z.infer<typeof NewReusableComponent>

export async function createReusableComponent(
  payload: NewReusableComponent,
  tx?: PrismaTransaction
): Promise<APIReusableComponent> {
  const component = await (tx ?? prisma()).reusableComponent.create({
    data: {
      ...payload,
      state: Buffer.from(payload.state, 'base64'),
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })

  return {
    ...component,
    state: component.state.toString('base64'),
    createdAt: component.createdAt.toISOString(),
    updatedAt: component.updatedAt.toISOString(),
  }
}

export const UpdateReusableComponent = z.object({
  state: base64Schema,
  title: z.string(),
})
export type UpdateReusableComponent = z.infer<typeof UpdateReusableComponent>
export async function updateReusableComponent(
  componentId: string,
  payload: UpdateReusableComponent,
  tx?: PrismaTransaction
): Promise<APIReusableComponent> {
  const component = await (tx ?? prisma()).reusableComponent.update({
    where: { id: componentId },
    data: {
      ...payload,
      state: Buffer.from(payload.state, 'base64'),
    },
    include: {
      document: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  })

  return {
    ...component,
    state: component.state.toString('base64'),
    createdAt: component.createdAt.toISOString(),
    updatedAt: component.updatedAt.toISOString(),
  }
}
