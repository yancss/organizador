import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { nextFinancialEntryCode } from '@/lib/finance-codes'

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
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  await ensureDefaultAccount(wsId)

  const url = new URL(req.url)
  const from = url.searchParams.get('from')
  const to = url.searchParams.get('to')
  const status = url.searchParams.get('status') // PAID | PLANNED | all
  const type = url.searchParams.get('type') // IN | OUT | all
  const accountId = url.searchParams.get('accountId')
  const categoryId = url.searchParams.get('categoryId')

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
      workspaceId: wsId,
      ...(status === 'PAID' || status === 'PLANNED' ? { status } : {}),
      ...(type === 'IN' || type === 'OUT' ? { type } : {}),
      ...(accountId ? { accountId } : {}),
      ...(categoryId ? { categoryId } : {}),
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
      code: true,
      competenceDate: true,
      paidAt: true,
      type: true,
      status: true,
      value: true,
      name: true,
      observations: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      salesOrderId: true,
      purchaseOrderId: true,
      purchaseId: true,
      consumptionId: true,
      salesOrder: { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, code: true } },
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
  name: z.string().max(200).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),

  // optional linkage
  salesOrderId: z.string().optional().nullable(),
  purchaseOrderId: z.string().optional().nullable(),
  purchaseId: z.string().optional().nullable(),
  consumptionId: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // sanity: account must belong to workspace
  const account = await prisma.financialAccount.findFirst({
    where: { id: parsed.data.accountId, workspaceId: wsId, active: true },
    select: { id: true },
  })
  if (!account) return Response.json({ error: 'INVALID_ACCOUNT' }, { status: 400 })

  if (parsed.data.categoryId) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId: wsId, active: true, type: parsed.data.type },
      select: { id: true },
    })
    if (!cat) return Response.json({ error: 'INVALID_CATEGORY' }, { status: 400 })
  }

  if (parsed.data.costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: parsed.data.costCenterId, workspaceId: wsId, active: true },
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

  const code = await nextFinancialEntryCode(wsId)

  const entry = await prisma.financialEntry.create({
    data: {
      workspaceId: wsId,
      code,
      competenceDate,
      paidAt,
      status,
      type: parsed.data.type,
      accountId: parsed.data.accountId,
      categoryId: parsed.data.categoryId ?? null,
      costCenterId: parsed.data.costCenterId ?? null,
      value: parsed.data.value,
      name: parsed.data.name ?? null,
      observations: parsed.data.observations ?? null,
      salesOrderId: parsed.data.salesOrderId ?? null,
      purchaseOrderId: parsed.data.purchaseOrderId ?? null,
      purchaseId: parsed.data.purchaseId ?? null,
      consumptionId: parsed.data.consumptionId ?? null,
    },
    select: {
      id: true,
      code: true,
      competenceDate: true,
      paidAt: true,
      type: true,
      status: true,
      value: true,
      name: true,
      observations: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      salesOrderId: true,
      purchaseOrderId: true,
      purchaseId: true,
      consumptionId: true,
      salesOrder: { select: { id: true, code: true, name: true } },
      purchaseOrder: { select: { id: true, code: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ entry }, { status: 201 })
}

