import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

async function requireUser() {
  // In local/dev mode, allow bypassing NextAuth entirely.
  // Important: do this BEFORE calling getServerSession to avoid NextAuth misconfig causing 500s.
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    enterWithUser(u.id)
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

async function ensureWorkspace(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    include: { workspace: true },
  })
  if (existing) return existing.workspace

  const ws = await prisma.workspace.create({
    data: { name: 'Meu espaço', members: { create: { userId, role: 'owner' } } },
  })
  return ws
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)

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
    workspaceId: ws.id,
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
    where: { workspaceId: ws.id, id: { in: ids } },
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
