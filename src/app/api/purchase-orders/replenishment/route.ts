import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { getAvailableQty, getInventoryReservationSnapshot } from '@/lib/inventory-reservations'
import { computeForecastedPurchaseSuggestion, computeSupplierCalendarLeadTime } from '@/lib/replenishment'

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

function criticalityScore(value: 'LOW' | 'MEDIUM' | 'HIGH') {
  if (value === 'HIGH') return 2
  if (value === 'MEDIUM') return 1
  return 0
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const supplierId = (url.searchParams.get('supplierId') ?? '').trim()
  const q = (url.searchParams.get('q') ?? '').trim()
  const risk = (url.searchParams.get('risk') ?? 'all').trim().toLowerCase()
  const readyOnly = ['1', 'true', 'yes'].includes((url.searchParams.get('readyOnly') ?? '').trim().toLowerCase())
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)

  const where = {
    workspaceId: wsId,
    minimum: { not: null },
    preferredSupplierId: supplierId || undefined,
    product: {
      active: true,
      kind: 'RAW' as const,
      ...(q.length >= 2 ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    },
  }

  const items = await prisma.inventory.findMany({
    where,
    orderBy: [{ preferredSupplier: { name: 'asc' } }, { product: { name: 'asc' } }],
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
      preferredSupplier: {
        select: {
          id: true,
          name: true,
          supplierOrderDays: true,
          supplierDeliveryDays: true,
          supplierOrderCutoffHour: true,
          supplierBlockedDates: true,
          supplierMinOrderValue: true,
        },
      },
      product: { select: { id: true, name: true, unit: true, avgCost: true, kind: true } },
      updatedAt: true,
    },
  })

  const reservationSnapshot = await getInventoryReservationSnapshot({
    workspaceId: wsId,
    productIds: items.map((item) => item.product.id),
  })

  const productIds = items.map((item) => item.product.id)
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

  const rawRows = items
    .map((item) => {
      const quantity = Number(item.quantity ?? 0)
      const reservedQty = reservationSnapshot.byProductId.get(item.product.id) ?? 0
      const availableQty = getAvailableQty({ quantity, reservedQty })
      const minimum = item.minimum == null ? null : Number(item.minimum)
      const reorderTarget = item.reorderTarget == null ? null : Number(item.reorderTarget)
      const supplierMinOrderQty = item.supplierMinOrderQty == null ? null : Number(item.supplierMinOrderQty)
      const supplierOrderMultiple = item.supplierOrderMultiple == null ? null : Number(item.supplierOrderMultiple)
      const avgDailyConsumption = (recentConsumptionByProduct.get(item.product.id) ?? 0) / 30
      const calendarLeadTime = computeSupplierCalendarLeadTime({
        baseLeadTimeDays: item.supplierLeadTimeDays ?? null,
        orderDays: item.preferredSupplier?.supplierOrderDays ?? [],
        deliveryDays: item.preferredSupplier?.supplierDeliveryDays ?? [],
        cutoffHour: item.preferredSupplier?.supplierOrderCutoffHour ?? null,
        blockedDates: item.preferredSupplier?.supplierBlockedDates ?? [],
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
      const estimatedUnitCost = item.product.avgCost == null ? null : Number(item.product.avgCost)
      const estimatedLineCost = estimatedUnitCost != null ? suggestion.purchaseQty * estimatedUnitCost : null
      return {
        id: item.id,
        quantity,
        reservedQty,
        availableQty,
        minimum,
        reorderTarget,
        criticality: item.criticality,
        supplierLeadTimeDays: item.supplierLeadTimeDays ?? null,
        effectiveLeadTimeDays: calendarLeadTime.effectiveLeadTimeDays,
        nextOrderInDays: calendarLeadTime.nextOrderInDays,
        deliveryOffsetDays: calendarLeadTime.deliveryOffsetDays,
        nextOrderDate: calendarLeadTime.nextOrderDate,
        expectedArrivalDate: calendarLeadTime.expectedArrivalDate,
        supplierMinOrderQty,
        supplierOrderMultiple,
        avgDailyConsumption,
        coverageDays: suggestion.coverageDays,
        projectedQtyAtLeadTime: suggestion.projectedQtyAtLeadTime,
        daysToMinimum: suggestion.daysToMinimum,
        purchaseWindowDays: suggestion.purchaseWindowDays,
        isInPurchaseWindow: suggestion.isInPurchaseWindow,
        riskLevel: suggestion.riskLevel,
        riskScore: suggestion.riskScore,
        criticalityScore: criticalityScore(item.criticality),
        shortageQty: suggestion.currentShortage,
        suggestedQty: suggestion.purchaseQty,
        economicSuggestedQty: 0,
        estimatedUnitCost,
        estimatedLineCost,
        economicEstimatedCost: 0,
        preferredSupplierId: item.preferredSupplierId ?? null,
        preferredSupplier: item.preferredSupplier,
        supplierMinOrderValue: item.preferredSupplier?.supplierMinOrderValue == null ? null : Number(item.preferredSupplier.supplierMinOrderValue),
        updatedAt: item.updatedAt,
        product: item.product,
      }
    })

  const urgentWindows = new Set(
    rawRows
      .filter((row) => row.riskLevel === 'urgent' && row.preferredSupplierId)
      .map((row) => `${row.preferredSupplierId}::${row.nextOrderDate ?? 'unscheduled'}`),
  )

  const rows = rawRows
    .map((row) => {
      const target = row.reorderTarget != null && row.reorderTarget > 0 ? row.reorderTarget : row.minimum
      const operationalQty = Number(row.suggestedQty ?? 0)
      const economicBaseQty =
        row.preferredSupplierId &&
        urgentWindows.has(`${row.preferredSupplierId}::${row.nextOrderDate ?? 'unscheduled'}`) &&
        row.riskLevel !== 'urgent' &&
        target != null &&
        target > row.quantity
          ? Math.max(0, target - row.quantity - operationalQty)
          : 0
      const economicSuggestedQty = economicBaseQty > 0 ? economicBaseQty : 0
      return {
        ...row,
        economicSuggestedQty,
        economicEstimatedCost: row.estimatedUnitCost != null ? economicSuggestedQty * row.estimatedUnitCost : 0,
      }
    })
    .filter((row) => row.suggestedQty > 0 || row.riskScore > 0 || row.economicSuggestedQty > 0)
    .filter((row) => {
      if (readyOnly && (row.nextOrderInDays ?? 0) > 0) return false
      if (risk === 'urgent') return row.riskLevel === 'urgent'
      if (risk === 'soon') return row.riskLevel === 'soon'
      if (risk === 'watch') return row.riskLevel === 'watch'
      if (risk === 'actionable') return row.riskLevel === 'urgent' || row.riskLevel === 'soon'
      return true
    })
    .sort(
      (a, b) =>
        b.riskScore - a.riskScore ||
        (a.nextOrderDate ?? '').localeCompare(b.nextOrderDate ?? '') ||
        b.criticalityScore - a.criticalityScore ||
        a.product.name.localeCompare(b.product.name),
    )

  const total = rows.length
  const skip = (page - 1) * take
  const pagedRows = rows.slice(skip, skip + take)

  const grouped = Array.from(
    rows.reduce((acc, row) => {
      const key = `${row.preferredSupplier?.id ?? 'unassigned'}::${row.nextOrderDate ?? 'unscheduled'}`
      const current = acc.get(key) ?? {
        supplierId: row.preferredSupplier?.id ?? null,
        supplierName: row.preferredSupplier?.name ?? null,
        nextOrderDate: row.nextOrderDate ?? null,
        expectedArrivalDate: row.expectedArrivalDate ?? null,
        nextOrderInDays: row.nextOrderInDays ?? null,
        readyToOrder: (row.nextOrderInDays ?? 0) <= 0,
        itemCount: 0,
        urgentCount: 0,
        consolidationCount: 0,
        totalSuggestedQty: 0,
        totalEconomicQty: 0,
        economicItemCount: 0,
        estimatedCost: 0,
        economicEstimatedCost: 0,
        minimumOrderValue: row.supplierMinOrderValue ?? null,
        missingToMinimumOrderValue: 0,
      }
      current.itemCount += 1
      current.urgentCount += row.riskLevel === 'urgent' ? 1 : 0
      current.consolidationCount += row.riskLevel === 'urgent' ? 0 : 1
      current.totalSuggestedQty += row.suggestedQty
      current.totalEconomicQty += row.economicSuggestedQty ?? 0
      current.economicItemCount += row.economicSuggestedQty > 0 ? 1 : 0
      current.estimatedCost += row.estimatedLineCost ?? 0
      current.economicEstimatedCost += row.economicEstimatedCost ?? 0
      current.readyToOrder = current.readyToOrder || (row.nextOrderInDays ?? 0) <= 0
      acc.set(key, current)
      return acc
    }, new Map<string, { supplierId: string | null; supplierName: string | null; nextOrderDate: string | null; expectedArrivalDate: string | null; nextOrderInDays: number | null; readyToOrder: boolean; itemCount: number; urgentCount: number; consolidationCount: number; totalSuggestedQty: number; totalEconomicQty: number; economicItemCount: number; estimatedCost: number; economicEstimatedCost: number; minimumOrderValue: number | null; missingToMinimumOrderValue: number }>()),
  )
    .map(([, group]) => ({
      ...group,
      missingToMinimumOrderValue:
        group.minimumOrderValue != null
          ? Math.max(0, group.minimumOrderValue - (group.estimatedCost + group.economicEstimatedCost))
          : 0,
    }))
    .sort(
      (a, b) =>
        b.urgentCount - a.urgentCount ||
        (a.nextOrderDate ?? '').localeCompare(b.nextOrderDate ?? '') ||
        (a.supplierName ?? '').localeCompare(b.supplierName ?? ''),
    )

  return Response.json({
    items: pagedRows,
    groups: grouped,
    summary: {
      urgentCount: rows.filter((row) => row.riskLevel === 'urgent').length,
      soonCount: rows.filter((row) => row.riskLevel === 'soon').length,
      watchCount: rows.filter((row) => row.riskLevel === 'watch').length,
      readyGroupCount: grouped.filter((group) => group.readyToOrder).length,
      suggestedQtyTotal: rows.reduce((acc, row) => acc + Number(row.suggestedQty ?? 0), 0),
      estimatedCostTotal: rows.reduce((acc, row) => acc + Number(row.estimatedLineCost ?? 0), 0),
    },
    meta: {
      page,
      take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  })
}
