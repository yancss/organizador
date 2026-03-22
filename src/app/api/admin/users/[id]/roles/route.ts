import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PutSchema = z.object({
  // null removes custom role
  roleId: z.string().min(1).nullable(),
  // force logout so JWT refreshes permissions immediately
  forceLogout: z.boolean().optional().default(true),
})

export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: userId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PutSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Ensure target user is in this workspace
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: wsId, userId },
    select: { id: true },
  })
  if (!member) return Response.json({ error: 'NOT_IN_WORKSPACE' }, { status: 400 })

  // Validate role id belongs to this workspace
  if (parsed.data.roleId) {
    const role = await prisma.workspaceRoleModel.findFirst({
      where: { workspaceId: wsId, id: parsed.data.roleId },
      select: { id: true },
    })
    if (!role) return Response.json({ error: 'INVALID_ROLE' }, { status: 400 })
  }

  const before = await prisma.workspaceUserRole.findFirst({
    where: { workspaceId: wsId, userId },
    select: { roleId: true },
  })

  await prisma.$transaction(async (tx) => {
    // One role per user: upsert when roleId is provided, otherwise delete
    if (parsed.data.roleId) {
      await tx.workspaceUserRole.upsert({
        where: { workspaceId_userId: { workspaceId: wsId, userId } },
        update: { roleId: parsed.data.roleId },
        create: {
          workspaceId: wsId,
          userId,
          roleId: parsed.data.roleId,
          createdById: auth.user.id,
        },
        select: { id: true },
      })
    } else {
      await tx.workspaceUserRole.deleteMany({ where: { workspaceId: wsId, userId } })
    }

    if (parsed.data.forceLogout) {
      await tx.user.update({ where: { id: userId }, data: { sessionPolicyVersion: { increment: 1 } } })
    }

    // Audit log
    await tx.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'PERMISSIONS',
        action: 'UPDATE',
        actorUserId: auth.user.id,
        targetUserId: userId,
        entityType: 'WorkspaceUserRole',
        entityId: userId,
        summary: `UPDATE user role#${userId}`,
        changes: {
          fromRoleId: before?.roleId ?? null,
          toRoleId: parsed.data.roleId,
          forceLogout: parsed.data.forceLogout,
        },
      },
      select: { id: true },
    })
  })

  return Response.json({ ok: true })
}
