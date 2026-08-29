import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

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
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)
  const skip = (page - 1) * take
  const status = (url.searchParams.get('status') ?? '').trim()

  const where = {
    workspaceId: wsId,
    ...(status ? { status: status as any } : {}),
  }

  const [total, approvals] = await prisma.$transaction([
    prisma.approvalRequest.count({ where }),
    prisma.approvalRequest.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip,
      take,
      select: {
        id: true,
        entityType: true,
        entityId: true,
        policyKey: true,
        reason: true,
        status: true,
        amount: true,
        decisionNote: true,
        decidedAt: true,
        requestedBy: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
        salesOrder: { select: { id: true, code: true, name: true, status: true } },
        purchaseOrder: { select: { id: true, code: true, status: true, supplierEntity: { select: { name: true } } } },
        salesQuote: { select: { id: true, code: true, status: true, name: true } },
        createdAt: true,
        updatedAt: true,
      },
    }),
  ])

  return Response.json({
    approvals,
    meta: {
      page,
      take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  })
}

