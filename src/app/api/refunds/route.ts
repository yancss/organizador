import { getServerSession } from 'next-auth'
import { z } from 'zod'

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

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const url = new URL(req.url)
  const salesOrderId = url.searchParams.get('salesOrderId')

  const refunds = await prisma.refund.findMany({
    where: {
      workspaceId: wsId,
      salesOrderId: salesOrderId ?? undefined,
    },
    orderBy: [{ requestedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      paymentId: true,
      status: true,
      method: true,
      requestedAt: true,
      completedAt: true,
      value: true,
      reason: true,
      reference: true,
      proofUrl: true,
      observations: true,
      payment: { select: { id: true, method: true, status: true, receivedAt: true, value: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ refunds })
}

const CreateSchema = z.object({
  salesOrderId: z.string().min(1),
  clientId: z.string().optional().nullable(),
  paymentId: z.string().optional().nullable(),

  // If not provided, we default based on payment.method when paymentId exists (CARD -> CARD_REVERSAL)
  method: z
    .enum(['CARD_REVERSAL', 'TRANSFER', 'PIX', 'MBWAY', 'CASH', 'OTHER'])
    .optional()
    .nullable(),

  value: z.coerce.number().positive(),
  reason: z.string().max(180).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  proofUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
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

  let payment: { id: string; method: 'CASH' | 'TRANSFER' | 'MBWAY' | 'PIX' | 'CARD' | 'OTHER'; clientId: string | null } | null =
    null

  if (parsed.data.paymentId) {
    payment = await prisma.payment.findFirst({
      where: { id: parsed.data.paymentId, workspaceId: wsId, salesOrderId: so.id },
      select: { id: true, method: true, clientId: true },
    })
    if (!payment) return Response.json({ error: 'PAYMENT_NOT_FOUND' }, { status: 404 })
  }

  const defaultMethod = payment?.method === 'CARD' ? 'CARD_REVERSAL' : 'TRANSFER'
  const method = (parsed.data.method ?? defaultMethod) as
    | 'CARD_REVERSAL'
    | 'TRANSFER'
    | 'PIX'
    | 'MBWAY'
    | 'CASH'
    | 'OTHER'

  const refund = await prisma.refund.create({
    data: {
      workspaceId: wsId,
      salesOrderId: so.id,
      clientId: parsed.data.clientId ?? payment?.clientId ?? so.clientId ?? null,
      paymentId: payment?.id ?? null,
      status: 'REQUESTED',
      method,
      value: parsed.data.value,
      reason: parsed.data.reason ?? null,
      reference: parsed.data.reference ?? null,
      proofUrl: parsed.data.proofUrl ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: { id: true },
  })

  const full = await prisma.refund.findFirst({
    where: { id: refund.id, workspaceId: wsId },
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      paymentId: true,
      status: true,
      method: true,
      requestedAt: true,
      completedAt: true,
      value: true,
      reason: true,
      reference: true,
      proofUrl: true,
      observations: true,
      payment: { select: { id: true, method: true, status: true, receivedAt: true, value: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ refund: full }, { status: 201 })
}
