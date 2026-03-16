import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const UpdateInventorySchema = z.object({
  quantity: z.coerce.number().optional(),
  minimum: z.coerce.number().optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { productId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateInventorySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const inv = await prisma.inventory.findFirst({
    where: { workspaceId: wsId, productId },
    select: { id: true },
  })
  if (!inv) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const updated = await prisma.inventory.update({
    where: { id: inv.id },
    data: {
      ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
      ...(parsed.data.minimum !== undefined ? { minimum: parsed.data.minimum ?? null } : {}),
    },
    select: {
      id: true,
      quantity: true,
      minimum: true,
      product: { select: { id: true, name: true, unit: true } },
      updatedAt: true,
    },
  })

  return Response.json({ item: updated })
}


