import { z } from 'zod'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const KEY = 'audit.retentionMonths'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId: wsId, key: KEY } },
    select: { value: true },
  })

  const months = Number((row?.value as any) ?? 3)
  const safe = months === 6 || months === 12 ? months : 3

  return Response.json({ months: safe })
}

const PatchSchema = z.object({
  months: z.union([z.literal(3), z.literal(6), z.literal(12)]),
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

  await prisma.workspaceSetting.upsert({
    where: { workspaceId_key: { workspaceId: wsId, key: KEY } },
    update: { value: parsed.data.months, updatedById: auth.user.id },
    create: { workspaceId: wsId, key: KEY, value: parsed.data.months, updatedById: auth.user.id },
    select: { key: true },
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'PERMISSIONS',
      action: 'UPDATE',
      actorUserId: auth.user.id,
      entityType: 'WorkspaceSetting',
      entityId: KEY,
      summary: 'UPDATE audit retention',
      changes: { create: [{ field: 'months', from: Prisma.JsonNull, to: parsed.data.months }] },
    },
    select: { id: true },
  })

  return Response.json({ ok: true, months: parsed.data.months })
}
