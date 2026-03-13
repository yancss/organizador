import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    enterWithUser(u.id)
    return { ok: true as const, userId: u.id }
  }

  if (!session || !userId) return { ok: false as const, status: 401 }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: 'UNAUTHORIZED' }, { status: auth.status })

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, name: true, email: true, birthDate: true },
  })

  return Response.json({ ok: true, user })
}

const PatchSchema = z.object({
  name: z.string().max(140).optional(),
  birthDate: z.string().nullable().optional(),
})

export async function PATCH(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: 'UNAUTHORIZED' }, { status: auth.status })

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

  const user = await prisma.user.update({
    where: { id: auth.userId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(birthDate !== undefined ? { birthDate } : {}),
    },
    select: { id: true, name: true, email: true, birthDate: true },
  })

  return Response.json({ ok: true, user })
}
