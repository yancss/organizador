import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { makeDocCode } from '@/lib/codes'
// Finance hooks (recebíveis/pagamentos) serão adicionados no próximo passo.

import { buildSalesOrdersWhere } from '@/lib/orders-query'
import { calcOrderTotals } from '@/lib/sales-order-totals'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)

  const where = buildSalesOrdersWhere({ wsId, userId: auth.user.id, params: url.searchParams })

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
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

  return Response.json({ orders })
}

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  // Used when discountMode=PER_ITEM
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
})

const CreateOrderSchema = z.object({
  name: z.string().min(1).max(140),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  deliveryAt: z.string().datetime().optional().nullable(),

  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),

  items: z.array(OrderItemSchema).optional(),
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
  if (parsed.data.items?.length) {
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
    const invalid = productIds.filter((id) => !allowedSet.has(id))
    if (invalid.length) {
      return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
    }
  }

  const discountMode = parsed.data.discountMode ?? 'SUBTOTAL'

  const totals = calcOrderTotals({
    items: (parsed.data.items ?? []).map((it) => ({
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

  const order = await prisma.salesOrder.create({
    data: {
      workspaceId: wsId,
      ownerId: auth.user.id,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      code: makeDocCode('SO'),
      name: parsed.data.name,
      observations: parsed.data.observations ?? null,
      clientId: parsed.data.clientId ?? null,
      orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
      deliveryAt: parsed.data.deliveryAt ? new Date(parsed.data.deliveryAt) : null,
      status: 'DRAFT',

      discountMode,
      discountType: parsed.data.discountType ?? null,
      discountValue: parsed.data.discountValue ?? null,
      discountPercent: parsed.data.discountPercent ?? null,

      value: totals.total,
      orderIndex: String(Date.now()),
      items: parsed.data.items?.length
        ? {
            create: parsed.data.items.map((it) => ({
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

  return Response.json({ order }, { status: 201 })
}

