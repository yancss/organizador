import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { ensurePendingApprovalRequest, evaluateSalesDiscount, getApprovalPolicy, hasApprovedApprovalRequest, type WorkspaceActorRole } from '@/lib/approval-policies'
import { buildSalesOrderReservationSummary, getInventoryReservationSnapshot } from '@/lib/inventory-reservations'
import { calcOrderTotals } from '@/lib/sales-order-totals'
import { canTransitionSalesOrderStatus } from '@/lib/sales-order-status'
import { convertQty, convertUnitPrice, isConvertible, normalizeUnit } from '@/lib/unit-conversion'
// Finance hooks (recebíveis/pagamentos) serão adicionados no próximo passo.

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  // Optional input unit (when user types qty/price in a different unit than Product.unit)
  unit: z.string().optional().nullable(),
  // Used when discountMode=PER_ITEM
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
})

const UpdateOrderSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  deliveryAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE', 'CANCELLED']).optional(),

  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),

  orderIndex: z.string().max(64).optional().nullable(),
  items: z.array(OrderItemSchema).optional(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const order = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      code: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      status: true,
      value: true,

      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,

      client: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discountType: true,
          discountValue: true,
          discountPercent: true,
          product: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!order) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: order.items.map((item) => item.product.id),
  })

  return Response.json({
    order: {
      ...order,
      reservationSummary: buildSalesOrderReservationSummary({
        salesOrderId: order.id,
        orderStatus: order.status,
        items: order.items.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.quantity ?? 0),
        })),
        snapshot: reservationSnapshot,
      }),
    },
  })
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const approvalPolicy = await getApprovalPolicy(wsId)

  // Fetch previous order state (needed to decide whether to create/update receivable)
  const prev = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      status: true,
      deliveryAt: true,
      updatedAt: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      items: { select: { productId: true, quantity: true, unitPrice: true, discountType: true, discountValue: true, discountPercent: true } },
    },
  })
  if (!prev) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const nextStatus = parsed.data.status ?? prev.status
  if (!canTransitionSalesOrderStatus(prev.status as any, nextStatus as any)) {
    return Response.json({ error: 'INVALID_STATUS_TRANSITION', from: prev.status, to: nextStatus }, { status: 400 })
  }

  const policyTotals = calcOrderTotals({
    items: (parsed.data.items as any) ?? prev.items,
    discountMode: (parsed.data.discountMode ?? prev.discountMode) as any,
    discountType: (parsed.data.discountType ?? prev.discountType) as any,
    discountValue: parsed.data.discountValue ?? prev.discountValue,
    discountPercent: parsed.data.discountPercent ?? prev.discountPercent,
  })

  const actorRole: WorkspaceActorRole = auth.user.isSuperadmin
    ? 'SUPERADMIN'
    : auth.user.workspaceRole === 'ADMIN'
      ? 'ADMIN'
      : 'USER'
  const discountEval = evaluateSalesDiscount(
    { subtotal: policyTotals.subtotal, total: policyTotals.total },
    actorRole,
    approvalPolicy,
  )
  if (discountEval.decision === 'BLOCKED' && nextStatus === 'CONFIRMED') {
    return Response.json(
      { error: 'DISCOUNT_EXCEEDS_HARD_CAP', hardCapPercent: discountEval.hardCapPercent, discountPercent: discountEval.discountPercent },
      { status: 400 },
    )
  }
  if (discountEval.decision === 'NEEDS_APPROVAL' && nextStatus === 'CONFIRMED') {
    const approved = await hasApprovedApprovalRequest({
      workspaceId: wsId,
      entityType: 'SALES_ORDER',
      entityId: id,
      policyKey: 'SALES_ORDER_DISCOUNT',
    })
    if (!approved) {
      await ensurePendingApprovalRequest({
        workspaceId: wsId,
        entityType: 'SALES_ORDER',
        entityId: id,
        policyKey: 'SALES_ORDER_DISCOUNT',
        reason: 'Pedido com desconto acima da alçada do responsável',
        amount: discountEval.discountValue,
        requestedById: auth.user.id,
        salesOrderId: id,
      })
      return Response.json({ error: 'APPROVAL_REQUIRED', policyKey: 'SALES_ORDER_DISCOUNT' }, { status: 409 })
    }
  }

  const data: any = { updatedById: auth.user.id }
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.observations !== undefined) data.observations = parsed.data.observations ?? null
  if (parsed.data.clientId !== undefined) data.clientId = parsed.data.clientId ?? null
  if (parsed.data.orderedAt !== undefined) data.orderedAt = parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null
  if (parsed.data.deliveryAt !== undefined) data.deliveryAt = parsed.data.deliveryAt ? new Date(parsed.data.deliveryAt) : null
  if (parsed.data.status !== undefined) data.status = parsed.data.status

  if (parsed.data.discountMode !== undefined) data.discountMode = parsed.data.discountMode
  if (parsed.data.discountType !== undefined) data.discountType = parsed.data.discountType ?? null
  if (parsed.data.discountValue !== undefined) data.discountValue = parsed.data.discountValue ?? null
  if (parsed.data.discountPercent !== undefined) data.discountPercent = parsed.data.discountPercent ?? null

  if (parsed.data.orderIndex !== undefined) data.orderIndex = parsed.data.orderIndex ?? null

  const updated = await prisma.salesOrder.updateMany({
    where: { id, workspaceId: wsId },
    data,
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  // Explicit audit for status changes.
  // Rationale: status changes are high-signal and should be visible even if the Prisma audit extension skips/noises.
  if (parsed.data.status !== undefined && parsed.data.status !== prev.status) {
    await prisma.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId: auth.user.id,
        entityType: 'SalesOrder',
        entityId: id,
        summary: `STATUS SalesOrder#${id}`,
        changes: { create: [{ field: 'status', from: prev.status, to: parsed.data.status }] },
        meta: { via: 'api/orders/[id] PATCH' },
      },
    })
  }

  // NOTE: Recebível real por expedição + pagamentos antecipados serão implementados no módulo novo.

  // Itens: estratégia simples (MVP) = substituir tudo.
  if (parsed.data.items) {
    // Garantir que itens do pedido só podem ser produtos finais
    if (parsed.data.items.length) {
      const productIds = [...new Set(parsed.data.items.map((it) => it.productId))]
      const allowed = await prisma.product.findMany({
        where: {
          workspaceId: wsId,
          id: { in: productIds },
          active: true,
          kind: 'FINISHED',
        },
        select: { id: true },
      })
      const allowedSet = new Set(allowed.map((p) => p.id))
      const invalid = productIds.filter((pid) => !allowedSet.has(pid))
      if (invalid.length) {
        return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
      }
    }

    const discountMode = (parsed.data.discountMode ?? prev.discountMode) as any

    // Normalize item units/prices to the product base unit.
    const normalized = parsed.data.items.length
      ? await Promise.all(
          parsed.data.items.map(async (it) => {
            const p = await prisma.product.findFirst({ where: { id: it.productId, workspaceId: wsId }, select: { unit: true } })
            const baseUnit = p?.unit
            if (!baseUnit) throw new Error('PRODUCT_NOT_FOUND')

            const inputUnitRaw = it.unit ?? null
            const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
            const baseUnitN = normalizeUnit(baseUnit)
            if (!baseUnitN) throw new Error('INVALID_PRODUCT_UNIT')

            const u = inputUnit ?? baseUnitN
            if (!isConvertible(u, baseUnitN)) {
              return { ok: false as const, error: 'INCOMPATIBLE_UNITS', productId: it.productId, from: u, to: baseUnitN }
            }

            const qtyBase = convertQty(it.quantity, u, baseUnitN)
            const unitPriceBase = convertUnitPrice(it.unitPrice, u, baseUnitN)

            return {
              ok: true as const,
              item: {
                ...it,
                quantity: qtyBase,
                unitPrice: unitPriceBase,
              },
            }
          }),
        )
      : []

    const bad = normalized.find((x: any) => x && x.ok === false)
    if (bad) {
      return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: bad }, { status: 400 })
    }

    const itemsBase = normalized.map((x: any) => x.item)

    // Explicit audit for item changes (high-signal)
    // Compare prev.items (DB) vs itemsBase (normalized input)
    const prevByPid = new Map(prev.items.map((it: any) => [it.productId, it]))
    const nextByPid = new Map(itemsBase.map((it: any) => [it.productId, it]))

    const changeRows: Array<{ field: string; from: any; to: any }> = []
    const allPids = new Set<string>([...prevByPid.keys(), ...nextByPid.keys()])
    for (const pid of allPids) {
      const a: any = prevByPid.get(pid)
      const b: any = nextByPid.get(pid)

      if (!a && b) {
        changeRows.push({ field: `items.${pid}.added`, from: null, to: true })
        changeRows.push({ field: `items.${pid}.quantity`, from: null, to: b.quantity })
        changeRows.push({ field: `items.${pid}.unitPrice`, from: null, to: b.unitPrice })
        continue
      }
      if (a && !b) {
        changeRows.push({ field: `items.${pid}.removed`, from: true, to: null })
        continue
      }
      if (!a || !b) continue

      const eqMoney = (x: any, y: any) => {
        const ax = Number(x)
        const by = Number(y)
        if (!Number.isFinite(ax) || !Number.isFinite(by)) return x === y
        return Math.abs(ax - by) < 0.005
      }

      if (Number(a.quantity) !== Number(b.quantity)) {
        changeRows.push({ field: `items.${pid}.quantity`, from: a.quantity, to: b.quantity })
      }
      if (!eqMoney(a.unitPrice, b.unitPrice)) {
        changeRows.push({ field: `items.${pid}.unitPrice`, from: a.unitPrice, to: b.unitPrice })
      }

      const aDt = a.discountType ?? null
      const bDt = discountMode === 'PER_ITEM' ? (b.discountType ?? null) : null
      if (aDt !== bDt) changeRows.push({ field: `items.${pid}.discountType`, from: aDt, to: bDt })

      const aDv = a.discountValue ?? null
      const bDv = discountMode === 'PER_ITEM' ? (b.discountValue ?? null) : null
      if (Number(aDv ?? 0) !== Number(bDv ?? 0)) changeRows.push({ field: `items.${pid}.discountValue`, from: aDv, to: bDv })

      const aDp = a.discountPercent ?? null
      const bDp = discountMode === 'PER_ITEM' ? (b.discountPercent ?? null) : null
      if (Number(aDp ?? 0) !== Number(bDp ?? 0)) changeRows.push({ field: `items.${pid}.discountPercent`, from: aDp, to: bDp })
    }

    if (changeRows.length) {
      await prisma.auditEvent.create({
        data: {
          workspaceId: wsId,
          category: 'CRUD',
          action: 'UPDATE',
          actorUserId: auth.user.id,
          entityType: 'SalesOrder',
          entityId: id,
          summary: `ITEMS SalesOrder#${id}`,
          changes: { create: changeRows },
          meta: { via: 'api/orders/[id] PATCH' },
        },
      })
    }

    await prisma.salesOrderItem.deleteMany({ where: { salesOrderId: id } })
    if (itemsBase.length) {
      await prisma.salesOrderItem.createMany({
        data: itemsBase.map((it: any) => ({
          salesOrderId: id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountType: discountMode === 'PER_ITEM' ? (it.discountType ?? null) : null,
          discountValue: discountMode === 'PER_ITEM' ? (it.discountValue ?? null) : null,
          discountPercent: discountMode === 'PER_ITEM' ? (it.discountPercent ?? null) : null,
        })),
      })
    }
  }

  // Recalculate totals and persist value
  const next = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      value: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      items: { select: { quantity: true, unitPrice: true, discountType: true, discountValue: true, discountPercent: true } },
    },
  })

  if (next) {
    const totals = calcOrderTotals({
      items: next.items,
      discountMode: next.discountMode as any,
      discountType: next.discountType as any,
      discountValue: next.discountValue,
      discountPercent: next.discountPercent,
    })
    // Only persist value when it actually changes (avoid extra UPDATE_MANY + noisy audits)
    const prevValue = next.value == null ? null : Number(next.value)
    const nextValue = totals.total
    if (prevValue == null || Math.abs(prevValue - nextValue) >= 0.005) {
      await prisma.salesOrder.updateMany({ where: { id, workspaceId: wsId }, data: { value: nextValue, updatedById: auth.user.id } })
    }

    if (evaluateSalesDiscount({ subtotal: totals.subtotal, total: totals.total }, actorRole, approvalPolicy).decision === 'NEEDS_APPROVAL') {
      await ensurePendingApprovalRequest({
        workspaceId: wsId,
        entityType: 'SALES_ORDER',
        entityId: id,
        policyKey: 'SALES_ORDER_DISCOUNT',
        reason: 'Pedido com desconto acima da alçada do responsável',
        amount: Math.max(0, totals.subtotal - totals.total),
        requestedById: auth.user.id,
        salesOrderId: id,
      })
    }
  }

  const order = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      code: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      status: true,
      value: true,

      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,

      client: { select: { id: true, name: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          unitPrice: true,
          discountType: true,
          discountValue: true,
          discountPercent: true,
          product: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      createdById: true,
      updatedById: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!order) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: order.items.map((item) => item.product.id),
  })

  return Response.json({
    order: {
      ...order,
      reservationSummary: buildSalesOrderReservationSummary({
        salesOrderId: order.id,
        orderStatus: order.status,
        items: order.items.map((item) => ({
          productId: item.product.id,
          quantity: Number(item.quantity ?? 0),
        })),
        snapshot: reservationSnapshot,
      }),
    },
  })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const deleted = await prisma.salesOrder.deleteMany({
    where: { id, workspaceId: wsId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


