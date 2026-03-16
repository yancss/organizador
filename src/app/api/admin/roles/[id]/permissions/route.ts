import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PatchSchema = z.object({
  permissionKeys: z.array(z.string().min(1)).max(500),
})

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: roleId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const role = await prisma.workspaceRoleModel.findFirst({
    where: { id: roleId, workspaceId: wsId },
    select: { id: true, isSystem: true },
  })
  if (!role) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (role.isSystem) return Response.json({ error: 'FORBIDDEN' }, { status: 403 })

  const perms = await prisma.permission.findMany({
    where: { key: { in: parsed.data.permissionKeys } },
    select: { id: true, key: true },
  })

  const permIds = perms.map((p) => p.id)

  await prisma.$transaction(async (tx) => {
    await tx.workspaceRolePermission.deleteMany({ where: { workspaceId: wsId, roleId } })
    if (permIds.length) {
      await tx.workspaceRolePermission.createMany({
        data: permIds.map((permissionId) => ({
          workspaceId: wsId,
          roleId,
          permissionId,
        })),
        skipDuplicates: true,
      })
    }

    await tx.workspaceRoleModel.update({ where: { id: roleId }, data: { updatedById: auth.user.id } })
  })

  // Force logout of non-admin users that might be affected? (optional)
  // For now we keep it manual.

  return Response.json({ ok: true })
}
