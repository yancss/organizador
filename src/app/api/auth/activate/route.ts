import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
  name: z.string().max(140).optional().nullable(),
  password: z.string().min(6).max(200),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const tokenHash = sha256(parsed.data.token)

  const invite = await prisma.userInviteToken.findUnique({
    where: { tokenHash },
    select: { id: true, email: true, expiresAt: true, usedAt: true, workspaceId: true, workspaceRole: true },
  })

  if (!invite || invite.email !== email) {
    return Response.json({ error: 'INVALID_TOKEN' }, { status: 400 })
  }

  if (invite.usedAt) {
    return Response.json({ error: 'TOKEN_USED' }, { status: 400 })
  }

  if (invite.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: 'TOKEN_EXPIRED' }, { status: 400 })
  }

  // Block activation if user already exists
  const existingUser = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existingUser) {
    return Response.json({ error: 'USER_ALREADY_EXISTS' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  const name = parsed.data.name?.trim() || null

  // Create user + membership + consume token atomically
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        active: true,
        role: 'USER',
      },
      select: { id: true },
    })

    await tx.workspaceMember.create({
      data: {
        workspaceId: invite.workspaceId,
        userId: user.id,
        role: invite.workspaceRole,
      },
      select: { id: true },
    })

    await tx.userInviteToken.update({
      where: { id: invite.id },
      data: { usedAt: new Date() },
      select: { id: true },
    })
  })

  return Response.json({ ok: true }, { status: 200 })
}
