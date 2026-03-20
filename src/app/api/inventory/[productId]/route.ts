import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { convertQty, isConvertible, normalizeUnit } from '@/lib/unit-conversion'

const UpdateInventorySchema = z.object({
  quantity: z.coerce.number().optional(),
  minimum: z.coerce.number().optional().nullable(),
  // Optional input unit (user may type in kg while product base is gr, etc.)
  unit: z.string().optional().nullable(),
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

  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { unit: true } })
  const baseUnit = product?.unit ? normalizeUnit(product.unit) : null
  if (!baseUnit) return Response.json({ error: 'INVALID_PRODUCT_UNIT' }, { status: 400 })

  const inputUnitRaw = parsed.data.unit ?? null
  const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
  const u = inputUnit ?? baseUnit

  if (!isConvertible(u, baseUnit)) {
    return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: { from: u, to: baseUnit } }, { status: 400 })
  }

  const qtyBase = parsed.data.quantity !== undefined ? convertQty(parsed.data.quantity, u, baseUnit) : undefined
  const minBase = parsed.data.minimum !== undefined ? (parsed.data.minimum == null ? null : convertQty(parsed.data.minimum, u, baseUnit)) : undefined

  const updated = await prisma.inventory.update({
    where: { id: inv.id },
    data: {
      ...(qtyBase !== undefined ? { quantity: qtyBase } : {}),
      ...(minBase !== undefined ? { minimum: minBase } : {}),
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


