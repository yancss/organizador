import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { makeDocCode } from '@/lib/codes'
import { ensurePendingApprovalRequest, getApprovalPolicy, needsPurchaseOrderApproval } from '@/lib/approval-policies'
import { upsertPayableForPurchaseOrder as upsertDedicatedPayable } from '@/lib/payables'
import { convertQty, convertUnitPrice, isConvertible, normalizeUnit } from '@/lib/unit-conversion'
import { upsertPayableForPurchaseOrder } from '@/lib/finance-defaults'

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

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
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

  return Response.json({
    purchaseOrders: purchaseOrders.map((purchaseOrder) => ({
      ...purchaseOrder,
      receiptSummary: buildReceiptSummary(purchaseOrder.items),
    })),
  })
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().optional().nullable(),
  // Optional input unit (user may type qty/cost in kg while product base is gr, etc.)
  unit: z.string().optional().nullable(),
})

const CreateSchema = z.object({
  supplierId: z.string().min(1),
  supplier: z.any().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED']).optional(),
  observations: z.string().max(5000).optional().nullable(),
  estimatedCost: z.coerce.number().optional().nullable(),
  items: z.array(ItemSchema).optional(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Consolidate items (respect @@unique([purchaseOrderId, productId]))
  // If multiple lines for the same product include unitCost, it must match (after normalization to product base unit).
  const items = parsed.data.items ?? []
  const productIds = [...new Set(items.map((it) => it.productId))]
  const products = productIds.length
    ? await prisma.product.findMany({ where: { workspaceId: wsId, id: { in: productIds } }, select: { id: true, unit: true } })
    : []
  const unitByProduct = new Map(products.map((p) => [p.id, p.unit]))

  const consolidated = new Map<string, { quantity: number; unitCost: number | null }>()
  for (const it of items) {
    const baseUnitRaw = unitByProduct.get(it.productId)
    const baseUnit = baseUnitRaw ? normalizeUnit(baseUnitRaw) : null
    if (!baseUnit) return Response.json({ error: 'INVALID_PRODUCT_UNIT', productId: it.productId }, { status: 400 })

    const inputUnitRaw = it.unit ?? null
    const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
    const u = inputUnit ?? baseUnit

    if (!isConvertible(u, baseUnit)) {
      return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: { productId: it.productId, from: u, to: baseUnit } }, { status: 400 })
    }

    const qtyBase = convertQty(Number(it.quantity), u, baseUnit)
    const unitCostBase = it.unitCost == null ? null : convertUnitPrice(Number(it.unitCost), u, baseUnit)

    const prev = consolidated.get(it.productId)
    if (prev) {
      if (prev.unitCost != null && unitCostBase != null && Math.abs(prev.unitCost - unitCostBase) > 0.0001) {
        return Response.json({ error: 'MIXED_UNIT_COST' }, { status: 400 })
      }
      consolidated.set(it.productId, { quantity: prev.quantity + qtyBase, unitCost: prev.unitCost ?? unitCostBase })
    } else {
      consolidated.set(it.productId, { quantity: qtyBase, unitCost: unitCostBase })
    }
  }

  if (parsed.data.supplier != null) {
    return Response.json({ error: 'SUPPLIER_TEXT_NOT_ALLOWED' }, { status: 400 })
  }

  const supplier = await prisma.client.findFirst({
    where: { id: parsed.data.supplierId, workspaceId: wsId, roles: { has: 'SUPPLIER' } },
    select: { id: true },
  })
  if (!supplier) return Response.json({ error: 'INVALID_SUPPLIER' }, { status: 400 })

  const desiredStatus = parsed.data.status ?? 'DRAFT'
  const desiredCommitted =
    desiredStatus === 'CONFIRMED' || desiredStatus === 'PARTIALLY_RECEIVED' || desiredStatus === 'RECEIVED'
  const approvalPolicy = await getApprovalPolicy(wsId)
  const approvalRequired =
    desiredCommitted &&
    parsed.data.estimatedCost != null &&
    needsPurchaseOrderApproval(Number(parsed.data.estimatedCost), approvalPolicy)
  const nextStatus = approvalRequired ? 'DRAFT' : desiredStatus

  const po = await prisma.purchaseOrder.create({
    data: {
      workspaceId: wsId,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      code: makeDocCode('PO'),
      supplierId: parsed.data.supplierId,
      supplier: null,
      orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
      status: nextStatus,
      observations: parsed.data.observations ?? null,
      estimatedCost: parsed.data.estimatedCost ?? null,
      items: consolidated.size
        ? {
            create: Array.from(consolidated.entries()).map(([productId, it]) => ({ productId, quantity: it.quantity, unitCost: it.unitCost })),
          }
        : undefined,
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

  if (approvalRequired) {
    await ensurePendingApprovalRequest({
      workspaceId: wsId,
      entityType: 'PURCHASE_ORDER',
      entityId: po.id,
      policyKey: 'PURCHASE_ORDER_AMOUNT',
      reason: 'Pedido de compra acima da alcada padrao',
      amount: Number(parsed.data.estimatedCost ?? 0),
      requestedById: auth.user.id,
      purchaseOrderId: po.id,
    })
  }

  if (!approvalRequired && desiredCommitted) {
    const competenceDate = po.orderedAt ?? new Date()
    const value = Number(po.estimatedCost ?? 0)
    await upsertPayableForPurchaseOrder({
      workspaceId: wsId,
      purchaseOrderId: po.id,
      competenceDate,
      value,
    })
    await upsertDedicatedPayable({
      workspaceId: wsId,
      purchaseOrderId: po.id,
      supplierId: po.supplierEntity?.id ?? parsed.data.supplierId,
      competenceDate,
      plannedAmount: value,
      observations: po.observations ?? null,
    })
  }

  return Response.json(
    {
      purchaseOrder: {
        ...po,
        receiptSummary: buildReceiptSummary(po.items),
      },
      approvalRequired,
    },
    { status: 201 },
  )
}

