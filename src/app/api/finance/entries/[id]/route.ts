import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const PatchSchema = z.object({
  competenceDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional().nullable(),
  status: z.enum(['PLANNED', 'PAID']).optional(),
  type: z.enum(['IN', 'OUT']).optional(),
  accountId: z.string().min(1).optional(),
  categoryId: z.string().optional().nullable(),
  costCenterId: z.string().optional().nullable(),
  value: z.coerce.number().positive().optional(),
  name: z.string().max(200).optional().nullable(),
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

  const existing = await prisma.financialEntry.findFirst({
    where: { id, workspaceId: wsId },
    select: { id: true, type: true, status: true, paidAt: true, competenceDate: true },
  })
  if (!existing) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const nextType = parsed.data.type ?? existing.type

  if (parsed.data.accountId) {
    const account = await prisma.financialAccount.findFirst({
      where: { id: parsed.data.accountId, workspaceId: wsId, active: true },
      select: { id: true },
    })
    if (!account) return Response.json({ error: 'INVALID_ACCOUNT' }, { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'categoryId') && parsed.data.categoryId) {
    const cat = await prisma.financialCategory.findFirst({
      where: { id: parsed.data.categoryId, workspaceId: wsId, active: true, type: nextType },
      select: { id: true },
    })
    if (!cat) return Response.json({ error: 'INVALID_CATEGORY' }, { status: 400 })
  }

  if (Object.prototype.hasOwnProperty.call(parsed.data, 'costCenterId') && parsed.data.costCenterId) {
    const cc = await prisma.costCenter.findFirst({
      where: { id: parsed.data.costCenterId, workspaceId: wsId, active: true },
      select: { id: true },
    })
    if (!cc) return Response.json({ error: 'INVALID_COST_CENTER' }, { status: 400 })
  }

  const status = parsed.data.status

  // If status changes to PAID and paidAt wasn't provided, set paidAt automatically.
  // If status changes to PLANNED, clear paidAt.
  const hasPaidAt = Object.prototype.hasOwnProperty.call(parsed.data, 'paidAt')
  const nextStatus = status ?? existing.status
  const autoPaidAt =
    nextStatus === 'PAID'
      ? hasPaidAt
        ? undefined
        : existing.paidAt ?? new Date()
      : nextStatus === 'PLANNED'
        ? null
        : undefined

  const entry = await prisma.financialEntry.update({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.competenceDate != null ? { competenceDate: new Date(parsed.data.competenceDate) } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'paidAt')
        ? { paidAt: parsed.data.paidAt ? new Date(parsed.data.paidAt) : null }
        : autoPaidAt !== undefined
          ? { paidAt: autoPaidAt }
          : {}),
      ...(status != null ? { status } : {}),
      ...(parsed.data.type != null ? { type: parsed.data.type } : {}),
      ...(parsed.data.accountId != null ? { accountId: parsed.data.accountId } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'categoryId')
        ? { categoryId: parsed.data.categoryId ?? null }
        : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'costCenterId')
        ? { costCenterId: parsed.data.costCenterId ?? null }
        : {}),
      ...(parsed.data.value != null ? { value: parsed.data.value } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'name') ? { name: parsed.data.name ?? null } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'observations')
        ? { observations: parsed.data.observations ?? null }
        : {}),
    },
    select: {
      id: true,
      code: true,
      competenceDate: true,
      paidAt: true,
      type: true,
      status: true,
      value: true,
      name: true,
      observations: true,
      account: { select: { id: true, name: true } },
      category: { select: { id: true, name: true, type: true } },
      costCenter: { select: { id: true, name: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ entry })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  await prisma.financialEntry.delete({ where: { id, workspaceId: wsId } })

  return Response.json({ ok: true })
}


