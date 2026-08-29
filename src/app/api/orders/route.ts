import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { nextSalesOrderCode } from '@/lib/sales/sales-order-codes'
import { buildSalesOrderReservationSummary, getInventoryReservationSnapshot } from '@/lib/inventory-reservations'
import { convertQty, convertUnitPrice, isConvertible, normalizeUnit } from '@/lib/unit-conversion'
// Finance hooks (recebíveis/pagamentos) serão adicionados no próximo passo.

import { buildSalesOrdersWhere } from '@/lib/orders-query'
import { ensurePendingApprovalRequest, getApprovalPolicy, needsSalesOrderDiscountApproval } from '@/lib/approval-policies'
import { calcOrderTotals } from '@/lib/sales-order-totals'

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const mode = (url.searchParams.get('mode') ?? '').trim()
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)
  const skip = (page - 1) * take

  const where = buildSalesOrdersWhere({ wsId, userId: auth.user.id, params: url.searchParams })
  const orderSelect = {
    id: true,
    code: true,
    name: true,
    observations: true,
    orderedAt: true,
    deliveryAt: true,
    status: true,
    orderIndex: true,
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
      orderBy: { createdAt: 'asc' as const },
    },
    createdAt: true,
    updatedAt: true,
  }

  if (mode === 'list') {
    const [total, orders] = await prisma.$transaction([
      prisma.salesOrder.count({ where }),
      prisma.salesOrder.findMany({
        where,
        orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
        skip,
        take,
        select: orderSelect,
      }),
    ])

    const reservationSnapshot = await getInventoryReservationSnapshot({
      workspaceId: wsId,
      productIds: orders.flatMap((order) => order.items.map((item) => item.product.id)),
    })

    return Response.json({
      orders: orders.map((order) => ({
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
      })),
      meta: {
        page,
        take,
        total,
        totalPages: Math.max(1, Math.ceil(total / take)),
      },
    })
  }

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
    select: orderSelect,
  })

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: orders.flatMap((order) => order.items.map((item) => item.product.id)),
  })

  return Response.json({
    orders: orders.map((order) => ({
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
    })),
  })
}

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

const CreateOrderSchema = z.object({
  name: z.string().min(1).max(140),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().min(1),
  orderedAt: z.string().datetime().optional().nullable(),
  deliveryAt: z.string().datetime().optional().nullable(),

  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),

  items: z.array(OrderItemSchema).min(1),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Garantir que itens do pedido só podem ser produtos finais
  const productIds = [...new Set(parsed.data.items.map((it) => it.productId))]
  const allowed = await prisma.product.findMany({
    where: {
      workspaceId: wsId,
      id: { in: productIds },
      active: true,
      kind: 'FINISHED',
    },
    select: { id: true, unit: true },
  })
  const allowedSet = new Set(allowed.map((p) => p.id))
  const productUnitById = new Map(allowed.map((p) => [p.id, p.unit]))
  const invalid = productIds.filter((id) => !allowedSet.has(id))
  if (invalid.length) {
    return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
  }

  // Validate client belongs to the workspace
  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: wsId },
    select: { id: true },
  })
  if (!client) return Response.json({ error: 'CLIENT_NOT_FOUND' }, { status: 404 })

  const discountMode = parsed.data.discountMode ?? 'SUBTOTAL'

  // Normalize item units/prices to the product base unit.
  const normalizedItems = (parsed.data.items ?? []).length
    ? await Promise.all(
        (parsed.data.items ?? []).map(async (it) => {
          const baseUnit = productUnitById.get(it.productId)
          if (!baseUnit) throw new Error('PRODUCT_NOT_FOUND')

          const inputUnitRaw = it.unit ?? null
          const inputUnit = inputUnitRaw ? normalizeUnit(inputUnitRaw) : null
          const baseUnitN = normalizeUnit(baseUnit)
          if (!baseUnitN) throw new Error('INVALID_PRODUCT_UNIT')

          // If user did not send unit, assume base unit.
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

  const bad = normalizedItems.find((x: any) => x && x.ok === false)
  if (bad) {
    return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: bad }, { status: 400 })
  }

  const itemsForTotals = normalizedItems.map((x: any) => x.item)

  const totals = calcOrderTotals({
    items: itemsForTotals.map((it: any) => ({
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      discountType: it.discountType as any,
      discountValue: it.discountValue,
      discountPercent: it.discountPercent,
    })),
    discountMode,
    discountType: (parsed.data.discountType as any) ?? null,
    discountValue: parsed.data.discountValue,
    discountPercent: parsed.data.discountPercent,
  })

  const code = await nextSalesOrderCode(wsId)

  const order = await prisma.salesOrder.create({
    data: {
      workspaceId: wsId,
      ownerId: auth.user.id,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      code,
      name: parsed.data.name,
      observations: parsed.data.observations ?? null,
      clientId: parsed.data.clientId,
      orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : new Date(),
      deliveryAt: parsed.data.deliveryAt ? new Date(parsed.data.deliveryAt) : null,
      status: 'DRAFT',

      discountMode,
      discountType: parsed.data.discountType ?? null,
      discountValue: parsed.data.discountValue ?? null,
      discountPercent: parsed.data.discountPercent ?? null,

      value: totals.total,
      orderIndex: String(Date.now()),
      items: itemsForTotals.length
        ? {
            create: itemsForTotals.map((it: any) => ({
              productId: it.productId,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              discountType: discountMode === 'PER_ITEM' ? (it.discountType ?? null) : null,
              discountValue: discountMode === 'PER_ITEM' ? (it.discountValue ?? null) : null,
              discountPercent: discountMode === 'PER_ITEM' ? (it.discountPercent ?? null) : null,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      code: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      status: true,
      orderIndex: true,
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
      createdAt: true,
      updatedAt: true,
    },
  })

  // NOTE: Recebível real por expedição + pagamentos antecipados serão implementados no módulo novo.

  const approvalPolicy = await getApprovalPolicy(wsId)
  if (needsSalesOrderDiscountApproval({ subtotal: totals.subtotal, total: totals.total }, approvalPolicy)) {
    await ensurePendingApprovalRequest({
      workspaceId: wsId,
      entityType: 'SALES_ORDER',
      entityId: order.id,
      policyKey: 'SALES_ORDER_DISCOUNT',
      reason: 'Pedido com desconto fora da politica padrao',
      amount: totals.subtotal - totals.total,
      requestedById: auth.user.id,
      salesOrderId: order.id,
    })
  }

  return Response.json({ order }, { status: 201 })
}

