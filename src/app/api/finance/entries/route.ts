import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
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

async function ensureDefaultAccount(workspaceId: string) {
  // Default requested: a BANK account.
  const existing = await prisma.financialAccount.findFirst({
    where: { workspaceId, active: true, kind: 'BANK' },
    orderBy: [{ createdAt: 'asc' }],
    select: { id: true },
  })
  if (existing) return existing

  return prisma.financialAccount.create({
    data: { workspaceId, name: 'Banco', kind: 'BANK' },
    select: { id: true },
  })
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)
  await ensureDefaultAccount(ws.id)

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const status = url.searchParams.get('status') // PAID | PLANNED | all
  const type = url.searchParams.get('type') // IN | OUT | all

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

  const entries = await prisma.financialEntry.findMany({
    where: {
      workspaceId: ws.id,
      ...(status === 'PAID' || status === 'PLANNED' ? { status } : {}),
      ...(type === 'IN' || type === 'OUT' ? { type } : {}),
      ...(fromDate || toDate
        ? {
            competenceDate: {
              ...(fromDate ? { gte: fromDate } : {}),
              ...(toDate ? { lte: toDate } : {}),
            },
          }
        : {}),
    },
    orderBy: [{ competenceDate: 'desc' }, { createdAt: 'desc' }],
    take: 500,
    select: {
      id: true,
      competenceDate: true,
      paidAt: true,
      type: true,
      status: true,
      value: true,
      observations: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      salesOrderId: true,
      purchaseId: true,
      consumptionId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ entries })
}

const CreateSchema = z.object({
  competenceDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional().nullable(),
  status: z.enum(['PLANNED', 'PAID']).optional(),
  type: z.enum(['IN', 'OUT']),
  accountId: z.string().min(1),
  categoryId: z.string().optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  value: z.coerce.number().positive(),
  observations: z.string().max(5000).optional().nullable(),

  // optional linkage
  salesOrderId: z.string().optional().nullable(),
  purchaseId: z.string().optional().nullable(),
  consumptionId: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // sanity: account must belong to workspace
  const account = await prisma.financialAccount.findFirst({
    where: { id: parsed.data.accountId, workspaceId: ws.id, active: true },
    select: { id: true },
  })
  if (!account) return Response.json({ error: 'INVALID_ACCOUNT' }, { status: 400 })

  if (parsed.data.categoryId) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId: ws.id, active: true, type: parsed.data.type },
      select: { id: true },
    })
    if (!cat) return Response.json({ error: 'INVALID_CATEGORY' }, { status: 400 })
  }

  if (parsed.data.costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: parsed.data.costCenterId, workspaceId: ws.id, active: true },
      select: { id: true },
    })
    if (!cc) return Response.json({ error: 'INVALID_COST_CENTER' }, { status: 400 })
  }

  const competenceDate = parsed.data.competenceDate ? new Date(parsed.data.competenceDate) : new Date()
  const status = parsed.data.status ?? 'PAID'

  const paidAt =
    status === 'PAID'
      ? parsed.data.paidAt
        ? new Date(parsed.data.paidAt)
        : competenceDate
      : null

  const entry = await prisma.financialEntry.create({
    data: {
      workspaceId: ws.id,
      competenceDate,
      paidAt,
      status,
      type: parsed.data.type,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      costCenterId: parsed.data.costCenterId ?? null,
      value: parsed.data.value,
      observations: parsed.data.observations ?? null,
      salesOrderId: parsed.data.salesOrderId ?? null,
      purchaseId: parsed.data.purchaseId ?? null,
      consumptionId: parsed.data.consumptionId ?? null,
    },
    select: {
      id: true,
      competenceDate: true,
      paidAt: true,
      type: true,
      status: true,
      value: true,
      observations: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      salesOrderId: true,
      purchaseId: true,
      consumptionId: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ entry }, { status: 201 })
}
