import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { getAvailableQty, getInventoryReservationSnapshot } from '@/lib/inventory-reservations'
import { computePurchaseSuggestion } from '@/lib/replenishment'

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
  const q = (url.searchParams.get('q') ?? '').trim()
  const mode = (url.searchParams.get('mode') ?? '').trim()
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)
  const skip = (page - 1) * take
  const where = {
    workspaceId: wsId,
    ...(mode === 'replenishment'
      ? {
          minimum: { not: null },
          quantity: { lt: prisma.inventory.fields.minimum },
        }
      : {}),
    product: {
      active: true,
      ...(q.length >= 2
        ? {
            name: {
              contains: q,
              mode: 'insensitive' as const,
            },
          }
        : {}),
    },
  }

  const [total, items] = await prisma.$transaction([
    prisma.inventory.count({ where }),
    prisma.inventory.findMany({
      where,
      orderBy: [{ product: { name: 'asc' } }],
      skip,
      take,
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
        product: { select: { id: true, name: true, unit: true, kind: true, avgCost: true } },
        updatedAt: true,
      },
    }),
  ])

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: items.map((item) => item.product.id),
  })

  return Response.json({
    items: items.map((item) => {
      const quantity = Number(item.quantity ?? 0)
      const reservedQty = reservationSnapshot.byProductId.get(item.product.id) ?? 0
      const availableQty = getAvailableQty({ quantity, reservedQty })
      const minimum = item.minimum == null ? null : Number(item.minimum)
      const reorderTarget = item.reorderTarget == null ? null : Number(item.reorderTarget)
      const supplierMinOrderQty = item.supplierMinOrderQty == null ? null : Number(item.supplierMinOrderQty)
      const supplierOrderMultiple = item.supplierOrderMultiple == null ? null : Number(item.supplierOrderMultiple)
      const suggestion = computePurchaseSuggestion({
        quantity: availableQty,
        minimum,
        reorderTarget,
        minOrderQty: supplierMinOrderQty,
        orderMultiple: supplierOrderMultiple,
      })
      return {
        ...item,
        reservedQty,
        availableQty,
        suggestedQty: suggestion.purchaseQty,
        shortageQty: suggestion.shortage,
      }
    }),
    meta: {
      page,
      take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  })
}
