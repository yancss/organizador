import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const startOfTomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)

  const [
    openReceivables,
    overdueReceivables,
    plannedPayables,
    openSalesOrders,
    openDeliveries,
    shippedToday,
    paymentsToday,
    refundsRequested,
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
    prisma.financialEntry.aggregate({
      where: { workspaceId: wsId, type: 'OUT', status: 'PLANNED' },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.salesOrder.count({
      where: { workspaceId: wsId, status: { in: ['DRAFT', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED'] } },
    }),
    prisma.delivery.count({
      where: { workspaceId: wsId, status: { in: ['PLANNED', 'PICKING', 'SHIPPED'] } },
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
  ])

  return Response.json({
    cards: {
      receivablesOpen: {
        count: openReceivables._count._all,
        total: openReceivables._sum.value ?? 0,
      },
      receivablesOverdue: {
        count: overdueReceivables._count._all,
        total: overdueReceivables._sum.value ?? 0,
      },
      payablesPlanned: {
        count: plannedPayables._count._all,
        total: plannedPayables._sum.value ?? 0,
      },
      salesOrdersOpen: {
        count: openSalesOrders,
      },
      deliveriesOpen: {
        count: openDeliveries,
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
    },
  })
}

