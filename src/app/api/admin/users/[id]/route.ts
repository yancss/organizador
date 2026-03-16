import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PatchSchema = z.object({
  active: z.boolean().optional(),
  workspaceRole: z.enum(['USER', 'ADMIN']).optional(),
  // if true, bump policy version to force logout of active sessions
  forceLogout: z.boolean().optional().default(true),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: userId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Ensure target user is in this workspace
  const member = await prisma.workspaceMember.findFirst({
    where: { workspaceId: wsId, userId },
    select: { id: true, role: true },
  })
  if (!member) return Response.json({ error: 'NOT_IN_WORKSPACE' }, { status: 400 })

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, role: true } })
  if (!target) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const isSupport = (target.email || '').toLowerCase() === 'support.guardian.app@gmail.com'
  const isSuper = auth.user.isSuperadmin === true
  if (isSupport && !isSuper) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const dataUser: any = {}
  if (parsed.data.active !== undefined) {
    dataUser.active = parsed.data.active
    // Force logout when deactivating (or changing active state) to avoid stale JWTs
    if (parsed.data.forceLogout) {
      dataUser.sessionPolicyVersion = { increment: 1 }
    }
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(dataUser).length) {
      await tx.user.update({ where: { id: userId }, data: dataUser, select: { id: true } })
    }

    if (parsed.data.workspaceRole !== undefined) {
      await tx.workspaceMember.update({
        where: { id: member.id },
        data: { role: parsed.data.workspaceRole },
        select: { id: true },
      })

      if (parsed.data.forceLogout) {
        await tx.user.update({ where: { id: userId }, data: { sessionPolicyVersion: { increment: 1 } }, select: { id: true } })
      }
    }
  })

  return Response.json({ ok: true })
}
