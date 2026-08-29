import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { ensurePendingApprovalRequest, getApprovalPolicy, hasApprovedApprovalRequest, needsPurchaseOrderApproval } from '@/lib/approval-policies'
import { adjustInventory } from '@/lib/inventory-movements'
import { consumeInventoryLots } from '@/lib/inventory-lots'
import { deletePlannedPayableForPurchaseOrder, upsertPayableForPurchaseOrder } from '@/lib/finance-defaults'
import { cancelPayableForPurchaseOrder, upsertPayableForPurchaseOrder as upsertDedicatedPayable } from '@/lib/payables'
import { ensureDefaultWarehouse } from '@/lib/stock-locations'
import { convertQty, convertUnitPrice, isConvertible, normalizeUnit } from '@/lib/unit-conversion'

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000
}

function buildReceiptSummary(
  items: Array<{
    quantity: unknown
    receivedQty: unknown
    acceptedQty: unknown
    rejectedQty: unknown
  }>,
) {
  const normalizedItems = items.map((item) => {
    const orderedQty = Number(item.quantity ?? 0)
    const receivedQty = Number(item.receivedQty ?? 0)
    const acceptedQty = Number(item.acceptedQty ?? 0)
    const rejectedQty = Number(item.rejectedQty ?? 0)
    const pendingQty = Math.max(0, orderedQty - receivedQty)
    const hasDivergence = rejectedQty > 0.000001

    return {
      orderedQty,
      receivedQty,
      acceptedQty,
      rejectedQty,
      pendingQty,
      hasDivergence,
    }
  })

  return {
    orderedUnits: normalizedItems.reduce((acc, item) => acc + item.orderedQty, 0),
    receivedUnits: normalizedItems.reduce((acc, item) => acc + item.receivedQty, 0),
    acceptedUnits: normalizedItems.reduce((acc, item) => acc + item.acceptedQty, 0),
    rejectedUnits: normalizedItems.reduce((acc, item) => acc + item.rejectedQty, 0),
    pendingUnits: normalizedItems.reduce((acc, item) => acc + item.pendingQty, 0),
    pendingItems: normalizedItems.filter((item) => item.pendingQty > 0.000001).length,
    divergentItems: normalizedItems.filter((item) => item.hasDivergence).length,
    hasDivergence: normalizedItems.some((item) => item.hasDivergence),
  }
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().optional().nullable(),
  // Optional input unit (user may type qty/cost in kg while product base is gr, etc.)
  unit: z.string().optional().nullable(),
})

const PatchSchema = z.object({
  supplierId: z.string().optional(),
  supplier: z.any().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
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

  const approvalPolicy = await getApprovalPolicy(wsId)

  try {
    const result = await prisma.$transaction(async (tx) => {
    const prev = await tx.purchaseOrder.findFirst({
      where: { id, workspaceId: wsId },
      select: {
        id: true,
        code: true,
        status: true,
        receivedAt: true,
        items: { select: { productId: true, quantity: true, receivedQty: true, acceptedQty: true, rejectedQty: true, receiptObservation: true, unitCost: true } },
      },
    })
    if (!prev) throw new Error('NOT_FOUND')

    // Consolidate items (respect @@unique([purchaseOrderId, productId]))
    // If multiple lines for the same product include unitCost, it must match.
    const prevItems = new Map<string, { quantity: number; unitCost: number | null; receivedQty: number }>()
    for (const it of prev.items) {
      const prevIt = prevItems.get(it.productId)
      const unitCost = it.unitCost == null ? null : Number(it.unitCost)
      const receivedQty = Number(it.receivedQty ?? 0)
      if (prevIt) {
        if (prevIt.unitCost != null && unitCost != null && Math.abs(prevIt.unitCost - unitCost) > 0.0001) {
          throw new Error('MIXED_UNIT_COST')
        }
        prevItems.set(it.productId, { quantity: prevIt.quantity + Number(it.quantity), unitCost: prevIt.unitCost ?? unitCost, receivedQty: prevIt.receivedQty + receivedQty })
      } else {
        prevItems.set(it.productId, { quantity: Number(it.quantity), unitCost, receivedQty })
      }
    }

    const nextItems = new Map<string, { quantity: number; unitCost: number | null }>()
    if (parsed.data.items) {
      const items = parsed.data.items
      const productIds = [...new Set(items.map((it) => it.productId))]
      const products = productIds.length
        ? await tx.product.findMany({ where: { workspaceId: wsId, id: { in: productIds } }, select: { id: true, unit: true } })
        : []
      const unitByProduct = new Map(products.map((p) => [p.id, p.unit]))

      for (const it of items) {
        const baseUnitRaw = unitByProduct.get(it.productId)
        const baseUnit = baseUnitRaw ? normalizeUnit(baseUnitRaw) : null
        if (!baseUnit) throw new Error('INVALID_PRODUCT_UNIT')

        const inputUnitRaw = it.unit ?? null
        const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
        const u = inputUnit ?? baseUnit

        if (!isConvertible(u, baseUnit)) throw new Error('INCOMPATIBLE_UNITS')

        const qtyBase = convertQty(Number(it.quantity), u, baseUnit)
        const unitCostBase = it.unitCost == null ? null : convertUnitPrice(Number(it.unitCost), u, baseUnit)

        const prevIt = nextItems.get(it.productId)
        if (prevIt) {
          if (prevIt.unitCost != null && unitCostBase != null && Math.abs(prevIt.unitCost - unitCostBase) > 0.0001) {
            throw new Error('MIXED_UNIT_COST')
          }
          nextItems.set(it.productId, { quantity: prevIt.quantity + qtyBase, unitCost: prevIt.unitCost ?? unitCostBase })
        } else {
          nextItems.set(it.productId, { quantity: qtyBase, unitCost: unitCostBase })
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

    const prevCommitted = prev.status === 'CONFIRMED' || prev.status === 'PARTIALLY_RECEIVED' || prev.status === 'RECEIVED'
    const nextCommitted = nextStatus === 'CONFIRMED' || nextStatus === 'PARTIALLY_RECEIVED' || nextStatus === 'RECEIVED'

    const prevReceiptStarted = prev.status === 'PARTIALLY_RECEIVED' || prev.status === 'RECEIVED' || Array.from(prevItems.values()).some((it) => it.receivedQty > 0)
    const prevReceived = prev.status === 'RECEIVED'
    const nextReceived = nextStatus === 'RECEIVED'

    const nextEstimatedCost =
      parsed.data.estimatedCost !== undefined
        ? parsed.data.estimatedCost
        : (await tx.purchaseOrder.findFirst({ where: { id, workspaceId: wsId }, select: { estimatedCost: true } }))
            ?.estimatedCost ?? null

    if (nextCommitted && nextEstimatedCost != null && needsPurchaseOrderApproval(Number(nextEstimatedCost), approvalPolicy)) {
      const approved = await hasApprovedApprovalRequest({
        workspaceId: wsId,
        entityType: 'PURCHASE_ORDER',
        entityId: id,
        policyKey: 'PURCHASE_ORDER_AMOUNT',
      })
      if (!approved) {
        await ensurePendingApprovalRequest({
          workspaceId: wsId,
          entityType: 'PURCHASE_ORDER',
          entityId: id,
          policyKey: 'PURCHASE_ORDER_AMOUNT',
          reason: 'Pedido de compra acima da alcada padrao',
          amount: Number(nextEstimatedCost),
          requestedById: auth.user.id,
          purchaseOrderId: id,
        })
        throw new Error('APPROVAL_REQUIRED')
      }
    }

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

    // Once receipt starts, items become immutable to avoid stock/cost inconsistencies.
    if (prevReceiptStarted) {
      if (nextStatus === 'DRAFT' || nextStatus === 'CONFIRMED' || nextStatus === 'CANCELLED') throw new Error('CANNOT_ROLLBACK_RECEIPT')
      if (parsed.data.items) throw new Error('CANNOT_EDIT_RECEIVED_ITEMS')
    }

    // Inventory + avg cost adjustments happen ONLY on RECEIVED.
    // - If it WILL be received, apply next items (add to stock) and update avg cost.
    if (prevReceived) {
      const defaultWarehouse = await ensureDefaultWarehouse(tx as any, wsId, auth.user.id)
      for (const [productId, it] of prevItems.entries()) {
        const receiptEvents = await tx.$queryRaw<
          Array<{
            lotId: string | null
            quantity: unknown
            serialCodes: string[]
          }>
        >`
          SELECT
            evt."lotId",
            evt."quantity",
            evt."serialCodes"
          FROM "InventoryLotEvent" evt
          WHERE evt."workspaceId" = ${wsId}
            AND evt."productId" = ${productId}
            AND evt."eventType" = 'PURCHASE_RECEIPT'
            AND evt."referenceType" = 'PurchaseOrder'
            AND evt."referenceId" = ${prev.id}
          ORDER BY evt."createdAt" ASC
        `

        let remainingToReverse = roundQty(it.quantity)
        for (const event of receiptEvents) {
          if (remainingToReverse <= 0.000001) break
          if (!event.lotId) continue
          const eventQty = Number(event.quantity ?? 0)
          if (!Number.isFinite(eventQty) || eventQty <= 0.000001) continue
          const reverseQty = roundQty(Math.min(remainingToReverse, eventQty))
          const serialCodes = (event.serialCodes ?? []).filter(Boolean)

          await consumeInventoryLots(tx as any, {
            workspaceId: wsId,
            productId,
            warehouseId: defaultWarehouse.id,
            preferredLotId: event.lotId,
            preferredSerialCodes: serialCodes.length ? serialCodes.slice(0, Math.max(0, Math.round(reverseQty))) : [],
            quantity: reverseQty,
            eventType: 'PURCHASE_RECEIPT_REVERSAL',
            referenceType: 'PurchaseOrder',
            referenceId: prev.id,
            notes: 'Purchase order receipt reversal by original lot trace.',
          })

          remainingToReverse = roundQty(remainingToReverse - reverseQty)
        }

        if (remainingToReverse > 0.000001) {
          throw new Error('PURCHASE_RECEIPT_TRACE_REVERSAL_INCOMPLETE')
        }

        await adjustInventory(tx as any, {
          workspaceId: wsId,
          productId,
          delta: -it.quantity,
          userId: auth.user.id,
          movementType: 'PURCHASE_RECEIPT_REVERSAL',
          referenceType: 'PurchaseOrder',
          referenceId: prev.id,
          observations: 'Purchase order receipt reversal',
          unitCost: it.unitCost,
        })
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
        await adjustInventory(tx as any, {
          workspaceId: wsId,
          productId,
          delta: qtyIn,
          userId: auth.user.id,
          movementType: 'PURCHASE_RECEIPT',
          referenceType: 'PurchaseOrder',
          referenceId: prev.id,
          unitCost,
        })

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
            receivedQty: true,
            acceptedQty: true,
            rejectedQty: true,
            receiptObservation: true,
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
      await cancelPayableForPurchaseOrder(wsId, po.id)
    }
    if (nextCommitted) {
      await upsertPayableForPurchaseOrder({
        workspaceId: wsId,
        purchaseOrderId: po.id,
        competenceDate: po.orderedAt ?? new Date(),
        value: Number(po.estimatedCost ?? 0),
      })
      await upsertDedicatedPayable({
        workspaceId: wsId,
        purchaseOrderId: po.id,
        supplierId: po.supplierEntity?.id ?? null,
        competenceDate: po.orderedAt ?? new Date(),
        plannedAmount: Number(po.estimatedCost ?? 0),
        observations: po.observations ?? null,
      })
    }

    return po
    })

    return Response.json({ purchaseOrder: { ...result, receiptSummary: buildReceiptSummary(result.items) } })
  } catch (error: any) {
    const code = String(error?.message ?? error ?? 'UNKNOWN')
    if (code === 'NOT_FOUND') return Response.json({ error: code }, { status: 404 })
    if (code === 'APPROVAL_REQUIRED') {
      return Response.json({ error: code, policyKey: 'PURCHASE_ORDER_AMOUNT' }, { status: 409 })
    }
    if (
      code === 'PURCHASE_RECEIPT_TRACE_REVERSAL_INCOMPLETE' ||
      code === 'INVALID_SERIAL_SELECTION' ||
      code === 'SERIAL_SELECTION_QUANTITY_MISMATCH' ||
      code === 'SERIALIZED_LOT_PARTIAL_CONSUMPTION_UNSUPPORTED' ||
      code === 'INSUFFICIENT_SOURCE_STOCK'
    ) {
      return Response.json({ error: code }, { status: 409 })
    }
    return Response.json({ error: code }, { status: 400 })
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  await prisma.purchaseOrder.delete({ where: { id, workspaceId: wsId } })
  return Response.json({ ok: true })
}



