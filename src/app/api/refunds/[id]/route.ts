import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

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
  return existing?.workspaceId ?? null
}

const PatchSchema = z.object({
  status: z.enum(['REQUESTED', 'PROCESSING', 'DONE', 'FAILED']).optional(),
  method: z.enum(['CARD_REVERSAL', 'TRANSFER', 'PIX', 'MBWAY', 'CASH', 'OTHER']).optional(),
  completedAt: z.string().datetime().optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  proofUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const prev = await prisma.refund.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, status: true, paymentId: true },
  })
  if (!prev) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const nextStatus = parsed.data.status

  const refund = await prisma.refund.update({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.method !== undefined ? { method: parsed.data.method } : {}),
      ...(parsed.data.completedAt !== undefined
        ? { completedAt: parsed.data.completedAt ? new Date(parsed.data.completedAt) : null }
        : {}),
      ...(parsed.data.reference !== undefined ? { reference: parsed.data.reference ?? null } : {}),
      ...(parsed.data.proofUrl !== undefined ? { proofUrl: parsed.data.proofUrl ?? null } : {}),
      ...(parsed.data.observations !== undefined ? { observations: parsed.data.observations ?? null } : {}),
    },
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

  // Side-effect (AUTO): when refund is DONE, mark linked payment as REFUNDED
  // and reverse any applications this payment had on receivables.
  if (prev.status !== 'DONE' && refund.status === 'DONE') {
    const paymentId = prev.paymentId
    if (paymentId) {
      await prisma.$transaction(async (tx) => {
        await tx.payment.updateMany({
          where: { id: paymentId, workspaceId: wsId },
          data: { status: 'REFUNDED' },
        })

        const apps = await tx.paymentApplication.findMany({
          where: { workspaceId: wsId, paymentId },
          select: { id: true, receivableId: true },
        })

        const affectedReceivableIds = [...new Set(apps.map((a) => a.receivableId))]

        // Remove applications (MVP).
        // NOTE: This loses application history; next iteration could create a negative entry instead.
        await tx.paymentApplication.deleteMany({
          where: { workspaceId: wsId, paymentId },
        })

        // Recompute receivable statuses.
        for (const receivableId of affectedReceivableIds) {
          const r = await tx.receivable.findFirst({
            where: { id: receivableId, workspaceId: wsId },
            select: { id: true, value: true, status: true, applications: { select: { value: true } } },
          })
          if (!r) continue

          const applied = r.applications.reduce((acc, a) => acc + Number(a.value ?? 0), 0)
          const shouldBePaid = applied >= Number(r.value)

          await tx.receivable.update({
            where: { id: r.id, workspaceId: wsId },
            data: { status: shouldBePaid ? 'PAID' : 'OPEN' },
            select: { id: true },
          })
        }
      })
    }
  }

  // If refund is FAILED, keep payment as-is (operator can decide next action).

  return Response.json({ refund })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.refund.deleteMany({ where: { id, workspaceId: wsId } })
  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
