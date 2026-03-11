import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
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
  return existing?.workspaceId ?? null
}

const PatchSchema = z.object({
  dueAt: z.string().datetime().optional().nullable(),
  status: z.enum(['OPEN', 'PAID', 'CANCELLED']).optional(),
  applyPayments: z.boolean().optional(),
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

  const rec = await prisma.receivable.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, salesOrderId: true },
  })
  if (!rec) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (parsed.data.dueAt !== undefined || parsed.data.status !== undefined) {
    await prisma.receivable.update({
      where: { id, workspaceId: wsId },
      data: {
        ...(parsed.data.dueAt !== undefined ? { dueAt: parsed.data.dueAt ? new Date(parsed.data.dueAt) : null } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      },
      select: { id: true },
    })
  }

  if (parsed.data.applyPayments) {
    await applyAvailablePaymentsToReceivable({
      workspaceId: wsId,
      salesOrderId: rec.salesOrderId,
      receivableId: rec.id,
    })
  }

  const receivable = await prisma.receivable.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      salesOrderId: true,
      deliveryId: true,
      clientId: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      value: true,
      applications: {
        select: {
          id: true,
          value: true,
          appliedAt: true,
          payment: { select: { id: true, method: true, status: true, receivedAt: true } },
        },
        orderBy: { appliedAt: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ receivable })
}
