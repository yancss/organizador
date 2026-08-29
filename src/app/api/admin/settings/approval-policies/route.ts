import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'
import { APPROVAL_POLICY_KEY, DEFAULT_APPROVAL_POLICY, coerceApprovalPolicy } from '@/lib/approval-policies'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: wsId, key: APPROVAL_POLICY_KEY } },
    select: { value: true, updatedAt: true },
  })

  const policy = coerceApprovalPolicy(row?.value)
  const isCustom =
    row != null &&
    (policy.purchaseOrderAmountThreshold !== DEFAULT_APPROVAL_POLICY.purchaseOrderAmountThreshold ||
      policy.salesDiscountPercentThreshold !== DEFAULT_APPROVAL_POLICY.salesDiscountPercentThreshold ||
      policy.salesDiscountValueThreshold !== DEFAULT_APPROVAL_POLICY.salesDiscountValueThreshold)

  return Response.json({
    policy,
    defaults: DEFAULT_APPROVAL_POLICY,
    isCustom,
    updatedAt: row?.updatedAt ?? null,
  })
}

const PatchSchema = z.object({
  purchaseOrderAmountThreshold: z.coerce.number().min(0).max(1_000_000_000),
  salesDiscountPercentThreshold: z.coerce.number().min(0).max(100),
  salesDiscountValueThreshold: z.coerce.number().min(0).max(1_000_000_000),
})

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const before = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: wsId, key: APPROVAL_POLICY_KEY } },
    select: { value: true },
  })

  const nextValue = parsed.data

  await prisma.workspaceSetting.upsert({
    where: { workspaceId_key: { workspaceId: wsId, key: APPROVAL_POLICY_KEY } },
    update: { value: nextValue, updatedById: auth.user.id },
    create: { workspaceId: wsId, key: APPROVAL_POLICY_KEY, value: nextValue, updatedById: auth.user.id },
    select: { key: true },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'WorkspaceSetting',
      entityId: APPROVAL_POLICY_KEY,
      summary: 'UPDATE approval policies',
      changes: {
        create: [
          {
            field: 'approval.policies',
            from: (before?.value as Prisma.InputJsonValue) ?? Prisma.JsonNull,
            to: nextValue as Prisma.InputJsonValue,
          },
        ],
      },
    },
    select: { id: true },
  })

  return Response.json({ ok: true, policy: coerceApprovalPolicy(nextValue) })
}
