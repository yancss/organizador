import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { recordInventoryMovement } from '@/lib/inventory-ledger'
import { convertQty, isConvertible, normalizeUnit } from '@/lib/unit-conversion'
import { adjustDefaultWarehouseInventory } from '@/lib/stock-locations'

const UpdateInventorySchema = z.object({
  quantity: z.coerce.number().optional(),
  minimum: z.coerce.number().optional().nullable(),
  reorderTarget: z.coerce.number().optional().nullable(),
  criticality: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional(),
  preferredSupplierId: z.string().optional().nullable(),
  supplierLeadTimeDays: z.coerce.number().int().min(0).max(3650).optional().nullable(),
  supplierMinOrderQty: z.coerce.number().positive().optional().nullable(),
  supplierOrderMultiple: z.coerce.number().positive().optional().nullable(),
  adjustmentReason: z
    .enum(['COUNT', 'LOSS', 'DAMAGE', 'EXPIRATION', 'CORRECTION', 'RETURN', 'OTHER'])
    .optional()
    .nullable(),
  adjustmentNote: z.string().max(2000).optional().nullable(),
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
    select: { id: true, quantity: true },
  })
  if (!inv) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const product = await prisma.product.findFirst({ where: { id: productId, workspaceId: wsId }, select: { unit: true } })
  const baseUnit = product?.unit ? normalizeUnit(product.unit) : null
  if (!baseUnit) return Response.json({ error: 'INVALID_PRODUCT_UNIT' }, { status: 400 })

  if (parsed.data.preferredSupplierId) {
    const supplier = await prisma.client.findFirst({
      where: { id: parsed.data.preferredSupplierId, workspaceId: wsId, roles: { has: 'SUPPLIER' } },
      select: { id: true },
    })
    if (!supplier) return Response.json({ error: 'INVALID_SUPPLIER' }, { status: 400 })
  }

  const inputUnitRaw = parsed.data.unit ?? null
  const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
  const u = inputUnit ?? baseUnit

  if (!isConvertible(u, baseUnit)) {
    return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: { from: u, to: baseUnit } }, { status: 400 })
  }

  const qtyBase = parsed.data.quantity !== undefined ? convertQty(parsed.data.quantity, u, baseUnit) : undefined
  const minBase = parsed.data.minimum !== undefined ? (parsed.data.minimum == null ? null : convertQty(parsed.data.minimum, u, baseUnit)) : undefined
  const reorderTargetBase =
    parsed.data.reorderTarget !== undefined ? (parsed.data.reorderTarget == null ? null : convertQty(parsed.data.reorderTarget, u, baseUnit)) : undefined
  const supplierMinOrderQtyBase =
    parsed.data.supplierMinOrderQty !== undefined ? (parsed.data.supplierMinOrderQty == null ? null : convertQty(parsed.data.supplierMinOrderQty, u, baseUnit)) : undefined
  const supplierOrderMultipleBase =
    parsed.data.supplierOrderMultiple !== undefined ? (parsed.data.supplierOrderMultiple == null ? null : convertQty(parsed.data.supplierOrderMultiple, u, baseUnit)) : undefined

  const previousQty = Number(inv.quantity ?? 0)
  const qtyDelta = qtyBase === undefined ? 0 : qtyBase - previousQty
  const adjustmentReason = parsed.data.adjustmentReason ?? null
  const adjustmentNote = parsed.data.adjustmentNote?.trim() ? parsed.data.adjustmentNote.trim() : null

  if (qtyBase !== undefined && Math.abs(qtyDelta) > 0.000001 && !adjustmentReason) {
    return Response.json({ error: 'ADJUSTMENT_REASON_REQUIRED' }, { status: 400 })
  }

  const updated = await prisma.inventory.update({
    where: { id: inv.id },
    data: {
      ...(qtyBase !== undefined ? { quantity: qtyBase } : {}),
      ...(minBase !== undefined ? { minimum: minBase } : {}),
      ...(reorderTargetBase !== undefined ? { reorderTarget: reorderTargetBase } : {}),
      ...(parsed.data.criticality !== undefined ? { criticality: parsed.data.criticality } : {}),
      ...(parsed.data.preferredSupplierId !== undefined ? { preferredSupplierId: parsed.data.preferredSupplierId || null } : {}),
      ...(parsed.data.supplierLeadTimeDays !== undefined ? { supplierLeadTimeDays: parsed.data.supplierLeadTimeDays == null ? null : parsed.data.supplierLeadTimeDays } : {}),
      ...(supplierMinOrderQtyBase !== undefined ? { supplierMinOrderQty: supplierMinOrderQtyBase } : {}),
      ...(supplierOrderMultipleBase !== undefined ? { supplierOrderMultiple: supplierOrderMultipleBase } : {}),
    },
    select: {
      id: true,
      quantity: true,
      minimum: true,
      reorderTarget: true,
      criticality: true,
      supplierLeadTimeDays: true,
      supplierMinOrderQty: true,
      supplierOrderMultiple: true,
      preferredSupplierId: true,
      preferredSupplier: { select: { id: true, name: true } },
      product: { select: { id: true, name: true, unit: true } },
      updatedAt: true,
    },
  })

  if (qtyBase !== undefined && Math.abs(qtyDelta) > 0.000001) {
    await prisma.$transaction(async (tx) => {
      const warehouseAdjustment = await adjustDefaultWarehouseInventory(tx as any, {
        workspaceId: wsId,
        productId,
        delta: qtyDelta,
        userId: auth.user.id,
        disallowNegative: false,
      })

      await recordInventoryMovement(tx as any, {
        workspaceId: wsId,
        productId,
        warehouseId: warehouseAdjustment?.warehouseId ?? null,
        actorUserId: auth.user.id,
        movementType: 'MANUAL_ADJUSTMENT',
        quantity: qtyDelta,
        referenceType: 'Inventory',
        referenceId: updated.id,
        observations: [adjustmentReason, adjustmentNote].filter(Boolean).join(' - ') || 'Manual inventory quantity update',
        balanceAfterGlobal: Number(updated.quantity ?? 0),
        balanceAfterWarehouse: warehouseAdjustment?.balanceAfterWarehouse ?? null,
      })
    })
  }

  return Response.json({ item: updated })
}


