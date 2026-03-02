import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

const CreateUserSchema = z.object({
  name: z.string().max(140).optional().nullable(),
  email: z.string().email(),
  password: z.string().min(6).max(200),
  birthDate: z.string().nullable().optional(),
})

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  const parsed = CreateUserSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const email = parsed.data.email.trim().toLowerCase()
  const name = parsed.data.name?.trim() || null

  const birthDate = parsed.data.birthDate
    ? new Date(parsed.data.birthDate)
    : null

  if (birthDate && Number.isNaN(birthDate.getTime())) {
    return Response.json({ error: 'INVALID_BIRTHDATE' }, { status: 400 })
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } })
  if (existing) {
    return Response.json({ error: 'EMAIL_ALREADY_EXISTS' }, { status: 409 })
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10)

  const user = await prisma.user.create({
    data: {
      email,
      name,
      birthDate,
      passwordHash,
      active: true,
      role: 'user',
    },
    select: { id: true, email: true, name: true },
  })

  return Response.json({ ok: true, user }, { status: 201 })
}
