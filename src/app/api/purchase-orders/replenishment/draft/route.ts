import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { makeDocCode } from '@/lib/codes'
import { getAvailableQty, getInventoryReservationSnapshot } from '@/lib/inventory-reservations'
import { computeForecastedPurchaseSuggestion, computeSupplierCalendarLeadTime } from '@/lib/replenishment'

const BodySchema = z.object({
  supplierId: z.string().min(1),
  nextOrderDate: z.string().min(1).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })

  const supplier = await prisma.client.findFirst({
    where: { id: parsed.data.supplierId, workspaceId: wsId, roles: { has: 'SUPPLIER' } },
    select: {
      id: true,
      name: true,
      supplierOrderDays: true,
      supplierDeliveryDays: true,
      supplierOrderCutoffHour: true,
      supplierBlockedDates: true,
    },
  })
  if (!supplier) return Response.json({ error: 'INVALID_SUPPLIER' }, { status: 400 })

  const candidates = await prisma.inventory.findMany({
    where: {
      workspaceId: wsId,
      preferredSupplierId: supplier.id,
      minimum: { not: null },
      product: { active: true, kind: 'RAW' },
    },
    orderBy: [{ product: { name: 'asc' } }],
    select: {
      productId: true,
      quantity: true,
      minimum: true,
      reorderTarget: true,
      supplierLeadTimeDays: true,
      supplierMinOrderQty: true,
      supplierOrderMultiple: true,
      product: { select: { id: true, name: true, unit: true, avgCost: true } },
    },
  })

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: candidates.map((item) => item.productId),
  })

  const productIds = candidates.map((item) => item.productId)
  const since = new Date()
  since.setDate(since.getDate() - 30)
  const consumptionGroups = productIds.length
    ? await prisma.consumption.groupBy({
        by: ['productId'],
        where: {
          workspaceId: wsId,
          productId: { in: productIds },
          date: { gte: since },
        },
        _sum: { quantity: true },
      })
    : []
  const recentConsumptionByProduct = new Map(
    consumptionGroups.map((group) => [group.productId, Number(group._sum.quantity ?? 0)]),
  )

  const items = candidates
    .map((item) => {
      const quantity = Number(item.quantity ?? 0)
      const reservedQty = reservationSnapshot.byProductId.get(item.productId) ?? 0
      const availableQty = getAvailableQty({ quantity, reservedQty })
      const minimum = item.minimum == null ? null : Number(item.minimum)
      const reorderTarget = item.reorderTarget == null ? null : Number(item.reorderTarget)
      const supplierMinOrderQty = item.supplierMinOrderQty == null ? null : Number(item.supplierMinOrderQty)
      const supplierOrderMultiple = item.supplierOrderMultiple == null ? null : Number(item.supplierOrderMultiple)
      const avgDailyConsumption = (recentConsumptionByProduct.get(item.productId) ?? 0) / 30
      const calendarLeadTime = computeSupplierCalendarLeadTime({
        baseLeadTimeDays: item.supplierLeadTimeDays ?? null,
        orderDays: supplier.supplierOrderDays ?? [],
        deliveryDays: supplier.supplierDeliveryDays ?? [],
        cutoffHour: supplier.supplierOrderCutoffHour ?? null,
        blockedDates: supplier.supplierBlockedDates ?? [],
      })
      const suggestion = computeForecastedPurchaseSuggestion({
        quantity: availableQty,
        minimum,
        reorderTarget,
        avgDailyConsumption,
        leadTimeDays: calendarLeadTime.effectiveLeadTimeDays,
        minOrderQty: supplierMinOrderQty,
        orderMultiple: supplierOrderMultiple,
      })
      return {
        productId: item.productId,
        quantity: suggestion.purchaseQty,
        unitCost: item.product.avgCost == null ? null : Number(item.product.avgCost),
        nextOrderDate: calendarLeadTime.nextOrderDate,
        expectedArrivalDate: calendarLeadTime.expectedArrivalDate,
      }
    })
    .filter((item) => (parsed.data.nextOrderDate ? item.nextOrderDate === parsed.data.nextOrderDate : true))
    .filter((item) => item.quantity > 0)

  if (!items.length) return Response.json({ error: 'NO_REPLENISHMENT_ITEMS' }, { status: 400 })

  const estimatedCost = items.reduce((acc, item) => acc + (item.unitCost == null ? 0 : item.unitCost * item.quantity), 0)
  const nextOrderDates = Array.from(new Set(items.map((item) => item.nextOrderDate).filter(Boolean)))
  const expectedArrivalDates = Array.from(new Set(items.map((item) => item.expectedArrivalDate).filter(Boolean)))
  const planningNote = [
    'Gerado por reposicao de estoque',
    nextOrderDates.length ? `proximo pedido sugerido: ${nextOrderDates.join(', ')}` : null,
    expectedArrivalDates.length ? `chegada estimada: ${expectedArrivalDates.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join(' | ')

  const po = await prisma.purchaseOrder.create({
    data: {
      workspaceId: wsId,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      code: makeDocCode('PO'),
      supplierId: supplier.id,
      supplier: null,
      status: 'DRAFT',
      observations: parsed.data.observations?.trim() ? `${planningNote} | ${parsed.data.observations.trim()}` : planningNote,
      estimatedCost: estimatedCost > 0 ? estimatedCost : null,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitCost: item.unitCost,
        })),
      },
    },
    select: {
      id: true,
      code: true,
      status: true,
      supplierEntity: { select: { id: true, name: true } },
      items: { select: { id: true } },
    },
  })

  return Response.json({ purchaseOrder: po }, { status: 201 })
}
