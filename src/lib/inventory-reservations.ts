import type { SalesOrderStatus } from '@prisma/client'

import { prisma } from '@/lib/prisma'

const RESERVING_ORDER_STATUSES: SalesOrderStatus[] = ['CONFIRMED', 'IN_PRODUCTION', 'READY']
const SHIPPED_DELIVERY_STATUSES = ['SHIPPED', 'DELIVERED'] as const

type ReservationSnapshot = {
  byProductId: Map<string, number>
  byProductOrderKey: Map<string, number>
}

function roundQty(value: number) {
  return Math.round(value * 1000) / 1000
}

function keyFor(productId: string, salesOrderId: string) {
  return `${productId}::${salesOrderId}`
}

export async function getInventoryReservationSnapshot(args: {
  workspaceId: string
  productIds: string[]
}): Promise<ReservationSnapshot> {
  const productIds = [...new Set(args.productIds.filter(Boolean))]
  if (!productIds.length) {
    return {
      byProductId: new Map(),
      byProductOrderKey: new Map(),
    }
  }

  const [orderItems, shippedDeliveryItems] = await Promise.all([
    prisma.salesOrderItem.findMany({
      where: {
        productId: { in: productIds },
        salesOrder: {
          workspaceId: args.workspaceId,
          status: { in: RESERVING_ORDER_STATUSES },
        },
      },
      select: {
        productId: true,
        quantity: true,
        salesOrderId: true,
      },
    }),
    prisma.deliveryItem.findMany({
      where: {
        productId: { in: productIds },
        delivery: {
          workspaceId: args.workspaceId,
          status: { in: [...SHIPPED_DELIVERY_STATUSES] },
        },
      },
      select: {
        productId: true,
        quantity: true,
        delivery: { select: { salesOrderId: true } },
      },
    }),
  ])

  const orderedByProductOrder = new Map<string, number>()
  for (const item of orderItems) {
    const key = keyFor(item.productId, item.salesOrderId)
    orderedByProductOrder.set(key, roundQty((orderedByProductOrder.get(key) ?? 0) + Number(item.quantity ?? 0)))
  }

  const shippedByProductOrder = new Map<string, number>()
  for (const item of shippedDeliveryItems) {
    const key = keyFor(item.productId, item.delivery.salesOrderId)
    shippedByProductOrder.set(key, roundQty((shippedByProductOrder.get(key) ?? 0) + Number(item.quantity ?? 0)))
  }

  const byProductId = new Map<string, number>()
  const byProductOrderKey = new Map<string, number>()

  for (const [key, orderedQty] of orderedByProductOrder.entries()) {
    const reservedQty = Math.max(0, roundQty(orderedQty - (shippedByProductOrder.get(key) ?? 0)))
    if (reservedQty <= 0) continue

    byProductOrderKey.set(key, reservedQty)
    const productId = key.split('::', 1)[0]
    byProductId.set(productId, roundQty((byProductId.get(productId) ?? 0) + reservedQty))
  }

  return { byProductId, byProductOrderKey }
}

export function getReservedQtyForOrderItem(args: {
  salesOrderId: string
  productId: string
  orderStatus: SalesOrderStatus | string
  orderedQty: number
  snapshot: ReservationSnapshot
}) {
  if (!RESERVING_ORDER_STATUSES.includes(args.orderStatus as SalesOrderStatus)) return 0
  return Math.max(
    0,
    roundQty(
      Math.min(
        args.orderedQty,
        args.snapshot.byProductOrderKey.get(keyFor(args.productId, args.salesOrderId)) ?? 0,
      ),
    ),
  )
}

export function getAvailableQty(args: {
  quantity: number
  reservedQty?: number | null
}) {
  return roundQty(args.quantity - Number(args.reservedQty ?? 0))
}

export function getReservingOrderStatuses() {
  return [...RESERVING_ORDER_STATUSES]
}

export function buildSalesOrderReservationSummary(args: {
  salesOrderId: string
  orderStatus: SalesOrderStatus | string
  items: Array<{ productId: string; quantity: number }>
  snapshot: ReservationSnapshot
}) {
  const items = args.items.map((item) => {
    const orderedQty = roundQty(Number(item.quantity ?? 0))
    const reservedQty = getReservedQtyForOrderItem({
      salesOrderId: args.salesOrderId,
      productId: item.productId,
      orderStatus: args.orderStatus,
      orderedQty,
      snapshot: args.snapshot,
    })
    return {
      productId: item.productId,
      orderedQty,
      reservedQty,
      unreservedQty: roundQty(Math.max(0, orderedQty - reservedQty)),
    }
  })

  return {
    reservedQtyTotal: roundQty(items.reduce((acc, item) => acc + item.reservedQty, 0)),
    orderedQtyTotal: roundQty(items.reduce((acc, item) => acc + item.orderedQty, 0)),
    items,
  }
}
