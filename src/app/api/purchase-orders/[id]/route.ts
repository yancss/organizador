import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'
import { deletePlannedPayableForPurchaseOrder, upsertPayableForPurchaseOrder } from '@/lib/finance-defaults'

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().optional().nullable(),
})

const PatchSchema = z.object({
  supplierId: z.string().optional(),
  supplier: z.any().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'RECEIVED', 'CANCELLED']).optional(),
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
        code: true,
        status: true,
        receivedAt: true,
        items: { select: { productId: true, quantity: true, unitCost: true } },
      },
    })
    if (!prev) throw new Error('NOT_FOUND')

    // Consolidate items (respect @@unique([purchaseOrderId, productId]))
    // If multiple lines for the same product include unitCost, it must match.
    const prevItems = new Map<string, { quantity: number; unitCost: number | null }>()
    for (const it of prev.items) {
      const prevIt = prevItems.get(it.productId)
      const unitCost = it.unitCost == null ? null : Number(it.unitCost)
      if (prevIt) {
        if (prevIt.unitCost != null && unitCost != null && Math.abs(prevIt.unitCost - unitCost) > 0.0001) {
          throw new Error('MIXED_UNIT_COST')
        }
        prevItems.set(it.productId, { quantity: prevIt.quantity + Number(it.quantity), unitCost: prevIt.unitCost ?? unitCost })
      } else {
        prevItems.set(it.productId, { quantity: Number(it.quantity), unitCost })
      }
    }

    const nextItems = new Map<string, { quantity: number; unitCost: number | null }>()
    if (parsed.data.items) {
      for (const it of parsed.data.items) {
        const prevIt = nextItems.get(it.productId)
        const unitCost = it.unitCost == null ? null : Number(it.unitCost)
        if (prevIt) {
          if (prevIt.unitCost != null && unitCost != null && Math.abs(prevIt.unitCost - unitCost) > 0.0001) {
            throw new Error('MIXED_UNIT_COST')
          }
          nextItems.set(it.productId, { quantity: prevIt.quantity + Number(it.quantity), unitCost: prevIt.unitCost ?? unitCost })
        } else {
          nextItems.set(it.productId, { quantity: Number(it.quantity), unitCost })
        }
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

    const nextStatus = parsed.data.status ?? prev.status

    const prevCommitted = prev.status === 'CONFIRMED' || prev.status === 'RECEIVED'
    const nextCommitted = nextStatus === 'CONFIRMED' || nextStatus === 'RECEIVED'

    const prevReceived = prev.status === 'RECEIVED'
    const nextReceived = nextStatus === 'RECEIVED'

    const nextEstimatedCost =
      parsed.data.estimatedCost !== undefined
        ? parsed.data.estimatedCost
        : (await tx.purchaseOrder.findFirst({ where: { id, workspaceId: wsId }, select: { estimatedCost: true } }))
            ?.estimatedCost ?? null

    // Confirming a PO requires estimated cost so we can create a payable commitment.
    if (nextCommitted && (nextEstimatedCost == null || Number(nextEstimatedCost) <= 0)) {
      throw new Error('ESTIMATED_COST_REQUIRED')
    }

    // Receiving a PO requires unitCost for every item.
    if (nextReceived) {
      for (const [productId, it] of nextItems.entries()) {
        if (it.unitCost == null || !Number.isFinite(it.unitCost) || it.unitCost <= 0) {
          throw new Error('UNIT_COST_REQUIRED')
        }
        if (!Number.isFinite(it.quantity) || it.quantity <= 0) {
          throw new Error('INVALID_QUANTITY')
        }
        // keep TS/lint happy
        void productId
      }
    }

    // If a PO is already received, we don't allow undoing receipt or editing items.
    // Rationale: avgCost and inventory receipt would become inconsistent without a full cost history recalculation.
    if (prevReceived) {
      if (nextStatus !== 'RECEIVED') throw new Error('CANNOT_UNRECEIVE')
      if (parsed.data.items) throw new Error('CANNOT_EDIT_RECEIVED_ITEMS')
    }

    // Inventory + avg cost adjustments happen ONLY on RECEIVED.
    // - If it WILL be received, apply next items (add to stock) and update avg cost.
    if (prevReceived) {
      for (const [productId, it] of prevItems.entries()) {
        await adjustInventory(tx as any, { workspaceId: wsId, productId, delta: -it.quantity })
      }
    }

    if (nextReceived) {
      for (const [productId, it] of nextItems.entries()) {
        const inv = await tx.inventory.findUnique({ where: { productId }, select: { quantity: true } })
        const product = await tx.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { avgCost: true } })
        const currentQty = inv?.quantity == null ? 0 : Number(inv.quantity)
        const currentAvg = product?.avgCost == null ? 0 : Number(product.avgCost)

        const qtyIn = Number(it.quantity)
        const unitCost = Number(it.unitCost)

        // Update inventory first
        await adjustInventory(tx as any, { workspaceId: wsId, productId, delta: qtyIn })

        // Weighted average cost
        const denom = currentQty + qtyIn
        const nextAvg = denom > 0 ? (currentQty * currentAvg + qtyIn * unitCost) / denom : unitCost

        await tx.product.update({ where: { id: productId }, data: { avgCost: nextAvg } })
      }
    }

    const itemsUpdate = parsed.data.items
      ? {
          deleteMany: {},
          create: Array.from(nextItems.entries()).map(([productId, it]) => ({ productId, quantity: it.quantity, unitCost: it.unitCost })),
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
        updatedById: auth.user.id,
        supplierId: parsed.data.supplierId ?? undefined,
        supplier: null,
        orderedAt:
          parsed.data.orderedAt === undefined ? undefined : parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
        status: parsed.data.status ?? undefined,
        receivedAt: nextReceived && !prev.receivedAt ? new Date() : undefined,
        observations: parsed.data.observations ?? undefined,
        estimatedCost: parsed.data.estimatedCost ?? undefined,
        items: itemsUpdate,
      },
      select: {
        id: true,
        code: true,
        supplier: true,
        status: true,
        orderedAt: true,
        receivedAt: true,
        observations: true,
        estimatedCost: true,
        supplierEntity: { select: { id: true, name: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitCost: true,
            product: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
        createdAt: true,
        updatedAt: true,
      },
    })

    // Finance commitment (payable): create when CONFIRMED or RECEIVED; remove when leaving both.
    if (prevCommitted && !nextCommitted) {
      await deletePlannedPayableForPurchaseOrder(wsId, po.id)
    }
    if (nextCommitted) {
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



