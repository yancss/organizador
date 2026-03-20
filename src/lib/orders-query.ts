import type { SalesOrderStatus } from '@prisma/client'

type BuildArgs = {
  wsId: string
  userId: string
  params: URLSearchParams
}

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export function buildSalesOrdersWhere({ wsId, userId, params }: BuildArgs) {
  const view = (params.get('view') ?? 'upcoming') as 'upcoming' | 'history' | 'all'

  const where: any = { workspaceId: wsId }

  // Operational default: hide final/cancelled unless view=all
  if (view !== 'all') {
    where.status = { notIn: ['DONE', 'CANCELLED'] satisfies SalesOrderStatus[] }
  }

  // quick filters
  const owner = params.get('owner')
  const ownerId = params.get('ownerId')
  if (owner === 'me') where.ownerId = userId
  else if (ownerId) where.ownerId = ownerId

  const createdBy = params.get('createdBy')
  const createdById = params.get('createdById')
  if (createdBy === 'me') where.createdById = userId
  else if (createdById) where.createdById = createdById

  const clientId = params.get('clientId')
  if (clientId) where.clientId = clientId

  const status = params.getAll('status')
  if (status.length) where.status = { in: status as SalesOrderStatus[] }

  const q = (params.get('q') ?? '').trim()
  if (q.length >= 2) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
      { client: { name: { contains: q, mode: 'insensitive' } } },
    ]
  }

  // Date filtering
  const dateField = (params.get('dateField') ?? '').trim() as 'createdAt' | 'orderedAt' | 'deliveryAt' | ''
  const from = params.get('from')
  const to = params.get('to')
  if (dateField && (from || to)) {
    const range: any = {}
    if (from) range.gte = new Date(from)
    if (to) range.lte = new Date(to)
    where[dateField] = range
  } else {
    // View logic (legacy): upcoming/history by deliveryAt
    const today = startOfToday()
    if (view === 'history') where.deliveryAt = { lt: today }
    if (view === 'upcoming') {
      where.OR = [{ deliveryAt: null }, { deliveryAt: { gte: today } }]
    }
  }

  // DeliveryAt null handling when user explicitly requests
  const deliveryNull = params.get('deliveryAt')
  if (deliveryNull === 'null') where.deliveryAt = null

  const overdue = params.get('overdue')
  if (overdue === '1') {
    const today = startOfToday()
    where.deliveryAt = { lt: today }
    where.status = { notIn: ['DONE', 'CANCELLED'] satisfies SalesOrderStatus[] }
  }

  return where
}
