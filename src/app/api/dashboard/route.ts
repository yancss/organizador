import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'
import { computeForecastedPurchaseSuggestion, computeSupplierCalendarLeadTime } from '@/lib/replenishment'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const canViewFinance = hasPermission(auth.user, 'finance.view')
  const canViewSales = hasPermission(auth.user, 'sales.view')
  const canViewPurchases = hasPermission(auth.user, 'purchases.view')
  const canViewInventory = hasPermission(auth.user, 'inventory.view')
  const canViewApprovals = hasPermission(auth.user, 'workflow.view')

  const wsId = auth.user.workspaceId

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [
    openReceivables,
    overdueReceivables,
    committedPayables,
    quoteOrders,
    activeSalesOrders,
    openDeliveries,
    overdueDeliveries,
    shippedToday,
    paymentsToday,
    refundsRequested,
    pendingApprovals,
    inventoryItems,
  ] = await Promise.all([
    prisma.receivable.aggregate({
      where: { workspaceId: wsId, status: 'OPEN' },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.receivable.aggregate({
      where: { workspaceId: wsId, status: 'OPEN', dueAt: { lt: startOfToday } },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.payable.aggregate({
      where: { workspaceId: wsId, status: { in: ['PLANNED', 'ACCRUED'] } },
      _sum: { plannedAmount: true },
      _count: { _all: true },
    }),
    prisma.salesOrder.count({
      where: { workspaceId: wsId, status: { in: ['DRAFT', 'SENT', 'APPROVED'] } },
    }),
    prisma.salesOrder.count({
      where: { workspaceId: wsId, status: { in: ['CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED'] } },
    }),
    prisma.delivery.count({
      where: { workspaceId: wsId, status: { in: ['PLANNED', 'PICKING', 'SHIPPED'] } },
    }),
    prisma.delivery.count({
      where: {
        workspaceId: wsId,
        status: { in: ['PLANNED', 'PICKING', 'SHIPPED'] },
        plannedAt: { lt: startOfToday },
      },
    }),
    prisma.delivery.count({
      where: { workspaceId: wsId, shippedAt: { gte: startOfToday, lt: startOfTomorrow } },
    }),
    prisma.payment.aggregate({
      where: { workspaceId: wsId, receivedAt: { gte: startOfToday, lt: startOfTomorrow } },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.refund.count({
      where: { workspaceId: wsId, status: { in: ['REQUESTED', 'PROCESSING'] } },
    }),
    prisma.approvalRequest.count({
      where: { workspaceId: wsId, status: 'PENDING' },
    }),
    prisma.inventory.findMany({
      where: {
        workspaceId: wsId,
        minimum: { not: null },
        product: { active: true, kind: 'RAW' },
      },
      select: {
        quantity: true,
        minimum: true,
        reorderTarget: true,
        supplierLeadTimeDays: true,
        supplierMinOrderQty: true,
        supplierOrderMultiple: true,
        preferredSupplier: {
          select: {
            supplierOrderDays: true,
            supplierDeliveryDays: true,
            supplierOrderCutoffHour: true,
            supplierBlockedDates: true,
          },
        },
        product: { select: { id: true } },
      },
    }),
  ])

  const productIds = inventoryItems.map((item) => item.product.id)
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

  const criticalReplenishment = inventoryItems.reduce(
    (acc, item) => {
      const quantity = Number(item.quantity ?? 0)
      const minimum = item.minimum == null ? null : Number(item.minimum)
      const reorderTarget = item.reorderTarget == null ? null : Number(item.reorderTarget)
      const avgDailyConsumption = (recentConsumptionByProduct.get(item.product.id) ?? 0) / 30
      const calendarLeadTime = computeSupplierCalendarLeadTime({
        baseLeadTimeDays: item.supplierLeadTimeDays ?? null,
        orderDays: item.preferredSupplier?.supplierOrderDays ?? [],
        deliveryDays: item.preferredSupplier?.supplierDeliveryDays ?? [],
        cutoffHour: item.preferredSupplier?.supplierOrderCutoffHour ?? null,
        blockedDates: item.preferredSupplier?.supplierBlockedDates ?? [],
      })
      const suggestion = computeForecastedPurchaseSuggestion({
        quantity,
        minimum,
        reorderTarget,
        avgDailyConsumption,
        leadTimeDays: calendarLeadTime.effectiveLeadTimeDays,
        minOrderQty: item.supplierMinOrderQty == null ? null : Number(item.supplierMinOrderQty),
        orderMultiple: item.supplierOrderMultiple == null ? null : Number(item.supplierOrderMultiple),
      })

      if (suggestion.riskLevel === 'urgent') acc.urgent += 1
      else if (suggestion.riskLevel === 'soon') acc.soon += 1

      return acc
    },
    { urgent: 0, soon: 0 },
  )

  return Response.json({
    visibleCards: [
      ...(canViewFinance
        ? ['receivablesOpen', 'receivablesOverdue', 'payablesCommitted', 'paymentsToday', 'refundsPending']
        : []),
      ...(canViewSales
        ? ['quotesPending', 'salesOrdersInProgress', 'deliveriesOpen', 'deliveriesOverdue', 'deliveriesShippedToday']
        : []),
      ...(canViewApprovals ? ['approvalsPending'] : []),
      ...(canViewInventory ? ['inventoryCritical'] : []),
    ],
    cards: {
      receivablesOpen: {
        count: openReceivables._count._all,
        total: openReceivables._sum.value ?? 0,
      },
      receivablesOverdue: {
        count: overdueReceivables._count._all,
        total: overdueReceivables._sum.value ?? 0,
      },
      payablesCommitted: {
        count: committedPayables._count._all,
        total: committedPayables._sum.plannedAmount ?? 0,
      },
      quotesPending: {
        count: quoteOrders,
      },
      salesOrdersInProgress: {
        count: activeSalesOrders,
      },
      deliveriesOpen: {
        count: openDeliveries,
      },
      deliveriesOverdue: {
        count: overdueDeliveries,
      },
      deliveriesShippedToday: {
        count: shippedToday,
      },
      paymentsToday: {
        count: paymentsToday._count._all,
        total: paymentsToday._sum.value ?? 0,
      },
      refundsPending: {
        count: refundsRequested,
      },
      approvalsPending: {
        count: pendingApprovals,
      },
      inventoryCritical: {
        urgentCount: criticalReplenishment.urgent,
        soonCount: criticalReplenishment.soon,
      },
    },
  })
}

