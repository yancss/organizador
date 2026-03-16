import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'
import { deletePlannedPayableForPurchaseOrder, upsertPayableForPurchaseOrder } from '@/lib/finance-defaults'

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const PatchSchema = z.object({
  supplierId: z.string().optional(),
  supplier: z.any().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  observations: z.string().max(5000).optional().nullable(),
  estimatedCost: z.coerce.number().optional().nullable(),
  items: z.array(ItemSchema).optional(),
})

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.purchaseOrder.findFirst({
      where: { id, workspaceId: wsId },
      select: {
        id: true,
        status: true,
        items: { select: { productId: true, quantity: true } },
      },
    })
    if (!prev) throw new Error('NOT_FOUND')

    // Consolidate items (respect @@unique([purchaseOrderId, productId]))
    const prevItems = new Map<string, number>()
    for (const it of prev.items) prevItems.set(it.productId, (prevItems.get(it.productId) ?? 0) + Number(it.quantity))

    const nextItems = new Map<string, number>()
    if (parsed.data.items) {
      for (const it of parsed.data.items) {
        nextItems.set(it.productId, (nextItems.get(it.productId) ?? 0) + Number(it.quantity))
      }
    } else {
      // unchanged
      for (const [k, v] of prevItems.entries()) nextItems.set(k, v)
    }

    // Validate items: purchase orders are RAW purchases
    const productIds = [...nextItems.keys()]
    if (productIds.length) {
      const allowed = await tx.product.findMany({
        where: { workspaceId: wsId, id: { in: productIds }, active: true, kind: 'RAW' },
        select: { id: true },
      })
      const allowedSet = new Set(allowed.map((p) => p.id))
      const invalid = productIds.filter((pid) => !allowedSet.has(pid))
      if (invalid.length) throw new Error('INVALID_ITEM_PRODUCT')
    }

    if (parsed.data.supplier != null) throw new Error('SUPPLIER_TEXT_NOT_ALLOWED')

    const prevConfirmed = prev.status === 'CONFIRMED'
    const nextStatus = parsed.data.status ?? prev.status
    const nextConfirmed = nextStatus === 'CONFIRMED'

    const nextEstimatedCost =
      parsed.data.estimatedCost !== undefined
        ? parsed.data.estimatedCost
        : (await tx.purchaseOrder.findFirst({ where: { id, workspaceId: wsId }, select: { estimatedCost: true } }))
            ?.estimatedCost ?? null

    // Rigid rule: confirming a PO requires estimated cost so we can create a payable commitment.
    if (nextConfirmed && (nextEstimatedCost == null || Number(nextEstimatedCost) <= 0)) {
      throw new Error('ESTIMATED_COST_REQUIRED')
    }

    // Inventory adjustments:
    // - If it WAS confirmed, rollback previous items first (remove from stock)
    // - If it WILL be confirmed, apply next items (add to stock)
    if (prevConfirmed) {
      for (const [productId, qty] of prevItems.entries()) {
        await adjustInventory(tx as any, { workspaceId: wsId, productId, delta: -qty })
      }
    }

    if (nextConfirmed) {
      for (const [productId, qty] of nextItems.entries()) {
        await adjustInventory(tx as any, { workspaceId: wsId, productId, delta: qty })
      }
    }

    const itemsUpdate = parsed.data.items
      ? {
          deleteMany: {},
          create: Array.from(nextItems.entries()).map(([productId, quantity]) => ({ productId, quantity })),
        }
      : undefined

    // Supplier must always be a registered supplier
    if (parsed.data.supplierId !== undefined) {
      if (!parsed.data.supplierId) throw new Error('SUPPLIER_REQUIRED')
      const supplier = await tx.client.findFirst({
        where: { id: parsed.data.supplierId, workspaceId: wsId, roles: { has: 'SUPPLIER' } },
        select: { id: true },
      })
      if (!supplier) throw new Error('INVALID_SUPPLIER')
    }

    const po = await tx.purchaseOrder.update({
      where: { id, workspaceId: wsId },
      data: {
        supplierId: parsed.data.supplierId ?? undefined,
        supplier: null,
        orderedAt:
          parsed.data.orderedAt === undefined ? undefined : parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
        status: parsed.data.status ?? undefined,
        observations: parsed.data.observations ?? undefined,
        estimatedCost: parsed.data.estimatedCost ?? undefined,
        items: itemsUpdate,
      },
      select: {
        id: true,
        supplier: true,
        status: true,
        orderedAt: true,
        observations: true,
        estimatedCost: true,
        supplierEntity: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            product: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    // Finance commitment (payable): create when CONFIRMED, remove when leaving CONFIRMED.
    if (prevConfirmed && !nextConfirmed) {
      await deletePlannedPayableForPurchaseOrder(wsId, po.id)
    }
    if (nextConfirmed) {
      await upsertPayableForPurchaseOrder({
        workspaceId: wsId,
        purchaseOrderId: po.id,
        competenceDate: po.orderedAt ?? new Date(),
        value: Number(po.estimatedCost ?? 0),
      })
    }

    return po
  })

  return Response.json({ purchaseOrder: result })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  await prisma.purchaseOrder.delete({ where: { id, workspaceId: wsId } })
  return Response.json({ ok: true })
}



