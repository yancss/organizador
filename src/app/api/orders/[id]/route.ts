import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { calcOrderTotals } from '@/lib/sales-order-totals'
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
  status: z.enum(['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DONE', 'CANCELLED']).optional(),

  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),

  orderIndex: z.string().max(64).optional().nullable(),
  items: z.array(OrderItemSchema).optional(),
})

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
    await prisma.salesOrder.updateMany({ where: { id, workspaceId: wsId }, data: { value: totals.total } })
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
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ order })
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


