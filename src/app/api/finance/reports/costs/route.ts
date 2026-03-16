import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const status = url.searchParams.get('status') // PAID | PLANNED | all

  let fromDate: Date | undefined
  let toDate: Date | undefined

  if (from) {
    const d = new Date(from)
    if (!Number.isNaN(d.getTime())) fromDate = d
  }
  if (to) {
    const d = new Date(to)
    if (!Number.isNaN(d.getTime())) toDate = d
  }

  const where: any = {
    workspaceId: wsId,
    type: 'OUT',
    ...(status === 'PAID' || status === 'PLANNED' ? { status } : {}),
    ...(fromDate || toDate
      ? {
          competenceDate: {
            ...(fromDate ? { gte: fromDate } : {}),
            ...(toDate ? { lte: toDate } : {}),
          },
        }
      : {}),
  }

  const grouped = await prisma.financialEntry.groupBy({
    by: ['costCenterId'],
    where,
    _sum: { value: true },
    _count: { _all: true },
  })

  const ids = grouped.map((g) => g.costCenterId).filter((id): id is string => Boolean(id))
  const centers = await prisma.costCenter.findMany({
    where: { workspaceId: wsId, id: { in: ids } },
    select: { id: true, name: true },
  })
  const nameById = new Map(centers.map((c) => [c.id, c.name]))

  const rows = grouped
    .map((g) => ({
      costCenterId: g.costCenterId,
      costCenterName: g.costCenterId ? nameById.get(g.costCenterId) ?? '—' : 'Sem centro de custo',
      total: g._sum.value ?? 0,
      count: g._count._all,
    }))
    .sort((a, b) => Number(b.total) - Number(a.total))

  return Response.json({ rows })
}

