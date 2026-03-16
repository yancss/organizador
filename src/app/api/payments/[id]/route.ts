import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const PatchSchema = z.object({
  status: z.enum(['RECEIVED', 'REFUNDED', 'FAILED']).optional(),
  reference: z.string().max(120).optional().nullable(),
  proofUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

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
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const deleted = await prisma.payment.deleteMany({ where: { id, workspaceId: wsId } })
  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


