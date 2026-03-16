import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PatchSchema = z.object({
  name: z.string().min(2).max(60).optional(),
  description: z.string().max(200).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const role = await prisma.workspaceRoleModel.findFirst({ where: { id, workspaceId: wsId }, select: { id: true, isSystem: true } })
  if (!role) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (role.isSystem) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })

  const updated = await prisma.workspaceRoleModel.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.description !== undefined ? { description: parsed.data.description?.trim() ?? null } : {}),
      updatedById: auth.user.id,
    },
    select: { id: true, name: true, description: true },
  })

  return Response.json({ role: updated })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const role = await prisma.workspaceRoleModel.findFirst({ where: { id, workspaceId: wsId }, select: { id: true, isSystem: true } })
  if (!role) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (role.isSystem) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })

  await prisma.workspaceRoleModel.delete({ where: { id } })
  return Response.json({ ok: true })
}
