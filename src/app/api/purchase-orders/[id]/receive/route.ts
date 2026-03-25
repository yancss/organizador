import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'

const BodySchema = z.object({
  dryRun: z.coerce.boolean().optional(),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const body = await req.json().catch(() => ({}))
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const dryRun = parsed.data.dryRun ?? false

  const result = await prisma.$transaction(async (tx) => {
    const po = await tx.purchaseOrder.findFirst({
      where: { id, workspaceId: wsId },
      select: {
        id: true,
        status: true,
        receivedAt: true,
        orderedAt: true,
        estimatedCost: true,
        items: { select: { productId: true, quantity: true, unitCost: true } },
      },
    })
    if (!po) throw new Error('NOT_FOUND')

    const distinctItems = po.items.length
    const totalUnits = po.items.reduce((acc, it) => acc + Number(it.quantity ?? 0), 0)

    const summary = {
      distinctItems,
      totalUnits,
      estimatedCost: po.estimatedCost == null ? null : Number(po.estimatedCost),
    }

    if (dryRun) {
      return { summary, purchaseOrder: null as any }
    }

    if (po.status === 'RECEIVED') {
      // idempotent: already received
      return { summary, purchaseOrder: { id: po.id, status: po.status, receivedAt: po.receivedAt } }
    }

    // Validate unitCost for every item
    for (const it of po.items) {
      const unitCost = it.unitCost == null ? null : Number(it.unitCost)
      const qty = Number(it.quantity)
      if (!Number.isFinite(qty) || qty <= 0) throw new Error('INVALID_QUANTITY')
      if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) throw new Error('UNIT_COST_REQUIRED')
    }

    // Apply inventory + weighted avgCost (same rules as PATCH /purchase-orders/[id])
    for (const it of po.items) {
      const productId = it.productId
      const qtyIn = Number(it.quantity)
      const unitCost = Number(it.unitCost)

      const inv = await tx.inventory.findUnique({ where: { productId }, select: { quantity: true } })
      const product = await tx.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { avgCost: true } })
      const currentQty = inv?.quantity == null ? 0 : Number(inv.quantity)
      const currentAvg = product?.avgCost == null ? 0 : Number(product.avgCost)

      await adjustInventory(tx as any, { workspaceId: wsId, productId, delta: qtyIn })

      const denom = currentQty + qtyIn
      const nextAvg = denom > 0 ? (currentQty * currentAvg + qtyIn * unitCost) / denom : unitCost
      await tx.product.update({ where: { id: productId }, data: { avgCost: nextAvg } })
    }

    const updated = await tx.purchaseOrder.update({
      where: { id, workspaceId: wsId },
      data: {
        status: 'RECEIVED',
        receivedAt: po.receivedAt ?? new Date(),
        updatedById: auth.user.id,
      },
      select: {
        id: true,
        status: true,
        receivedAt: true,
      },
    })

    return { summary, purchaseOrder: updated }
  })

  return Response.json(result)
}
