import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  return { ok: true as const, userId }
}

async function ensureWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  if (existing) return existing.workspaceId

  const ws = await prisma.workspace.create({
    data: { name: 'Meu espaço', members: { create: { userId, role: 'owner' } } },
    select: { id: true },
  })
  return ws.id
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const [
    openReceivables,
    plannedPayables,
    openSalesOrders,
    openDeliveries,
    refundsRequested,
  ] = await Promise.all([
    prisma.receivable.aggregate({
      where: { workspaceId: wsId, status: 'OPEN' },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.financialEntry.aggregate({
      where: { workspaceId: wsId, type: 'OUT', status: 'PLANNED' },
      _sum: { value: true },
      _count: { _all: true },
    }),
    prisma.salesOrder.count({
      where: { workspaceId: wsId, status: { in: ['DRAFT', 'CONFIRMED'] } },
    }),
    prisma.delivery.count({
      where: { workspaceId: wsId, status: { in: ['PLANNED', 'PICKING', 'SHIPPED'] } },
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
      refundsPending: {
        count: refundsRequested,
      },
    },
  })
}
