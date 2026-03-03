import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { sha256 } from '@/lib/tokens'

const BodySchema = z.object({
  email: z.string().email(),
  token: z.string().min(10),
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

  const rec = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    select: { email: true, expiresAt: true, usedAt: true },
  })

  if (!rec || rec.email !== email) {
    return Response.json({ error: 'INVALID_TOKEN' }, { status: 400 })
  }
  if (rec.usedAt) {
    return Response.json({ error: 'TOKEN_USED' }, { status: 400 })
  }
  if (rec.expiresAt.getTime() < Date.now()) {
    return Response.json({ error: 'TOKEN_EXPIRED' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, active: true } })
  if (!user || user.active === false) {
    return Response.json({ error: 'INVALID_USER' }, { status: 400 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  await prisma.$transaction([
    prisma.user.update({
      where: { email },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
  ])

  return Response.json({ ok: true }, { status: 200 })
}
