import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const PatchSchema = z.object({
  // null => use system default (4h)
  sessionMaxAgeSec: z.number().int().positive().max(60 * 60 * 24 * 7).nullable().optional(),
  // if true, bump policy version to force logout of active sessions
  forceLogout: z.boolean().optional().default(true),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  // This endpoint changes global user session policy; restrict to SUPERADMIN only.
  if (auth.user.isSuperadmin !== true) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Extra guard: do not allow changing Support SUPERADMIN's session policy here unless superadmin.
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true, role: true } })
  if (!target) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const isSupport = (target.email || '').toLowerCase() === 'support.guardian.app@gmail.com'
  const isSuper = auth.user.isSuperadmin === true
  if (isSupport && !isSuper) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const data: any = {}
  if (parsed.data.sessionMaxAgeSec !== undefined) {
    data.sessionMaxAgeSec = parsed.data.sessionMaxAgeSec
  }
  if (parsed.data.forceLogout) {
    data.sessionPolicyVersion = { increment: 1 }
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, role: true, sessionMaxAgeSec: true, sessionPolicyVersion: true },
  })

  return Response.json({ user: updated })
}
