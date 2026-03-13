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
  status: z.enum(['RECEIVED', 'REFUNDED', 'FAILED']).optional(),
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

  const payment = await prisma.payment.update({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.reference !== undefined ? { reference: parsed.data.reference ?? null } : {}),
      ...(parsed.data.proofUrl !== undefined ? { proofUrl: parsed.data.proofUrl ?? null } : {}),
      ...(parsed.data.observations !== undefined ? { observations: parsed.data.observations ?? null } : {}),
    },
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

  return Response.json({ payment })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.payment.deleteMany({ where: { id, workspaceId: wsId } })
  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
