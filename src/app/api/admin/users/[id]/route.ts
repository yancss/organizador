import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PatchSchema = z.object({
  active: z.boolean().optional(),
  workspaceRole: z.enum(['USER', 'ADMIN']).optional(),
  email: z.string().email().optional(),
  name: z.string().max(140).nullable().optional(),
  birthDate: z.string().nullable().optional(), // ISO date (YYYY-MM-DD)
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

  const supportEmail = (process.env.SUPPORT_GUARDIAN_EMAIL || 'support.guardian.app@gmail.com').trim().toLowerCase()
  const isSupport = (target.email || '').toLowerCase() === supportEmail
  const isSuper = auth.user.isSuperadmin === true
  if (isSupport && !isSuper) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const dataUser: any = {}

  if (parsed.data.email !== undefined) {
    const email = parsed.data.email.trim().toLowerCase()

    // Superadmin/support email must never change (guard against lock-out)
    if (target.role === 'SUPERADMIN' && (target.email || '').toLowerCase() === supportEmail && email !== supportEmail) {
      return Response.json({ error: 'SUPERADMIN_EMAIL_LOCKED' }, { status: 409 })
    }

    // Block changing to an email that already exists
    const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } })
    if (exists && exists.id !== userId) {
      return Response.json({ error: 'EMAIL_IN_USE' }, { status: 409 })
    }

    dataUser.email = email
    if (parsed.data.forceLogout) {
      dataUser.sessionPolicyVersion = { increment: 1 }
    }
  }

  if (parsed.data.name !== undefined) {
    dataUser.name = parsed.data.name ? parsed.data.name.trim() : null
  }

  if (parsed.data.birthDate !== undefined) {
    if (parsed.data.birthDate === null || parsed.data.birthDate.trim() === '') {
      dataUser.birthDate = null
    } else {
      const d = new Date(parsed.data.birthDate)
      if (Number.isNaN(d.getTime())) {
        return Response.json({ error: 'INVALID_BIRTH_DATE' }, { status: 400 })
      }
      dataUser.birthDate = d
    }
  }

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
