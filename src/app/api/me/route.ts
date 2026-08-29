import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const user = await prisma.user.findUnique({
    where: { id: auth.user.id },
    select: { id: true, name: true, email: true, birthDate: true, avatarIcon: true, role: true, active: true },
  })

  return Response.json({
    ok: true,
    user,
    workspace: {
      id: auth.user.workspaceId,
      role: auth.user.workspaceRole,
      isSuperadmin: auth.user.isSuperadmin ?? false,
      permissions: 'permissions' in auth.user ? auth.user.permissions ?? [] : [],
    },
  })
}

const PatchSchema = z.object({
  name: z.string().max(140).optional(),
  birthDate: z.string().nullable().optional(),
  avatarIcon: z.string().max(40).nullable().optional(),
})

export async function PATCH(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name != null ? parsed.data.name.trim() : undefined

  let birthDate: Date | null | undefined = undefined
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'birthDate')) {
    if (parsed.data.birthDate == null || String(parsed.data.birthDate).trim() === '') {
      birthDate = null
    } else {
      const d = new Date(parsed.data.birthDate)
      if (Number.isNaN(d.getTime())) {
        return Response.json({ error: 'INVALID_BIRTHDATE' }, { status: 400 })
      }
      birthDate = d
    }
  }

  // avatarIcon
  let avatarIcon: string | null | undefined = undefined
  if (Object.prototype.hasOwnProperty.call(parsed.data, 'avatarIcon')) {
    const v = parsed.data.avatarIcon
    avatarIcon = v == null || String(v).trim() === '' ? null : String(v).trim()
  }

  const user = await prisma.user.update({
    where: { id: auth.user.id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
      ...(avatarIcon !== undefined ? { avatarIcon } : {}),
    },
    select: { id: true, name: true, email: true, birthDate: true, avatarIcon: true },
  })

  return Response.json({ ok: true, user })
}

