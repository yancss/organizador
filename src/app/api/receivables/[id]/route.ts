import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { applyAvailablePaymentsToReceivable } from '@/lib/sales/receivables'

const PatchSchema = z.object({
  dueAt: z.string().datetime().optional().nullable(),
  status: z.enum(['OPEN', 'PAID', 'CANCELLED']).optional(),
  applyPayments: z.boolean().optional(),
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


