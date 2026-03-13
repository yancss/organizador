import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'
import { applyAvailablePaymentsToReceivable } from '@/lib/sales/receivables'

async function requireUser() {
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

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const url = new URL(req.url)
  const salesOrderId = url.searchParams.get('salesOrderId')

  const payments = await prisma.payment.findMany({
    where: {
      workspaceId: wsId,
      salesOrderId: salesOrderId ?? undefined,
    },
    orderBy: [{ receivedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      method: true,
      status: true,
      receivedAt: true,
      value: true,
      reference: true,
      proofUrl: true,
      observations: true,
      applications: { select: { id: true, receivableId: true, value: true, appliedAt: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ payments })
}

const CreateSchema = z.object({
  salesOrderId: z.string().min(1),
  clientId: z.string().optional().nullable(),
  method: z.enum(['CASH', 'TRANSFER', 'MBWAY', 'PIX', 'CARD', 'OTHER']),
  receivedAt: z.string().datetime().optional().nullable(),
  value: z.coerce.number().positive(),
  reference: z.string().max(120).optional().nullable(),
  proofUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),

  // optional: apply immediately to a receivable
  applyToReceivableId: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const so = await prisma.salesOrder.findFirst({
    where: { id: parsed.data.salesOrderId, workspaceId: wsId, ownerId: auth.userId },
    select: { id: true, clientId: true },
  })
  if (!so) return Response.json({ error: 'SALES_ORDER_NOT_FOUND' }, { status: 404 })

  const payment = await prisma.payment.create({
    data: {
      workspaceId: wsId,
      salesOrderId: so.id,
      clientId: parsed.data.clientId ?? so.clientId ?? null,
      method: parsed.data.method,
      status: 'RECEIVED',
      receivedAt: parsed.data.receivedAt ? new Date(parsed.data.receivedAt) : new Date(),
      value: parsed.data.value,
      reference: parsed.data.reference ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: { id: true },
  })

  if (parsed.data.applyToReceivableId) {
    // best-effort apply against a specific receivable
    await applyAvailablePaymentsToReceivable({
      workspaceId: wsId,
      salesOrderId: so.id,
      receivableId: parsed.data.applyToReceivableId,
    })
  }

  const full = await prisma.payment.findFirst({
    where: { id: payment.id, workspaceId: wsId },
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      method: true,
      status: true,
      receivedAt: true,
      value: true,
      reference: true,
      proofUrl: true,
      observations: true,
      applications: { select: { id: true, receivableId: true, value: true, appliedAt: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ payment: full }, { status: 201 })
}
