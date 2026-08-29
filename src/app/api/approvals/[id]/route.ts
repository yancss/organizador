import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { applyApprovalOutcome } from '@/lib/approval-actions'

const PatchSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  decisionNote: z.string().max(2000).optional().nullable(),
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

  const updated = await prisma.approvalRequest.updateMany({
    where: { id, workspaceId: wsId, status: 'PENDING' },
    data: {
      status: parsed.data.status,
      decisionNote: parsed.data.decisionNote ?? null,
      decidedAt: new Date(),
      decidedById: auth.user.id,
    },
  })

  if (!updated.count) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const decided = await prisma.approvalRequest.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      workspaceId: true,
      entityType: true,
      entityId: true,
      policyKey: true,
      status: true,
      requestedBy: { select: { id: true, name: true, email: true } },
    },
  })

  // G7: ao decidir, avança o pedido bloqueado (quando aprovado) e notifica o solicitante.
  let outcome: Awaited<ReturnType<typeof applyApprovalOutcome>> | null = null
  if (decided && (decided.status === 'APPROVED' || decided.status === 'REJECTED')) {
    outcome = await applyApprovalOutcome(
      {
        id: decided.id,
        workspaceId: decided.workspaceId,
        entityType: decided.entityType as 'PURCHASE_ORDER' | 'SALES_ORDER',
        entityId: decided.entityId,
        policyKey: decided.policyKey,
        status: decided.status as 'APPROVED' | 'REJECTED',
        requestedBy: decided.requestedBy,
      },
      auth.user.id,
    ).catch(() => null)
  }

  const approval = await prisma.approvalRequest.findFirst({
    where: { id, workspaceId: wsId },
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
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ approval, outcome })
}
