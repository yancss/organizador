import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    // pick first user in DB (or create a default)
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: 'dev@guardian.local',
          name: 'Dev',
          active: true,
          role: 'owner',
        },
        select: { id: true },
      })
    }
    return { ok: true, userId: u.id }
  }

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
  return { ok: true as const, userId }
}

async function userWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  return existing?.workspaceId ?? null
}

function normalizeE164(input: string) {
  const trimmed = input.trim()
  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')
  return (hasPlus ? '+' : '+') + digits
}

const E164Like = z
  .string()
  .max(50)
  .transform((v) => normalizeE164(v))
  .refine((v) => /^\+[1-9]\d{6,14}$/.test(v), 'INVALID_PHONE_E164')

const UpdateClientSchema = z.object({
  name: z.string().min(1).max(140).optional(),

  phone: E164Like.optional().nullable(),
  phoneCountry: z.string().length(2).optional().nullable(),

  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),

  idType: z.string().max(32).optional().nullable(),
  idNumber: z.string().max(64).optional().nullable(),
  idCountry: z.string().length(2).optional().nullable(),

  addressCountry: z.string().length(2).optional().nullable(),
  addressPostalCode: z.string().max(16).optional().nullable(),
  addressState: z.string().max(80).optional().nullable(),
  addressCity: z.string().max(120).optional().nullable(),
  addressDistrict: z.string().max(120).optional().nullable(),
  addressStreet: z.string().max(180).optional().nullable(),
  addressNumber: z.string().max(32).optional().nullable(),
  addressComplement: z.string().max(180).optional().nullable(),

  address: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateClientSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.client.updateMany({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),

      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone ?? null } : {}),
      ...(parsed.data.phoneCountry !== undefined ? { phoneCountry: parsed.data.phoneCountry ?? null } : {}),

      ...(parsed.data.birthDate !== undefined
        ? { birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null }
        : {}),

      ...(parsed.data.idType !== undefined ? { idType: parsed.data.idType ?? null } : {}),
      ...(parsed.data.idNumber !== undefined ? { idNumber: parsed.data.idNumber ?? null } : {}),
      ...(parsed.data.idCountry !== undefined ? { idCountry: parsed.data.idCountry ?? null } : {}),

      ...(parsed.data.addressCountry !== undefined ? { addressCountry: parsed.data.addressCountry ?? null } : {}),
      ...(parsed.data.addressPostalCode !== undefined
        ? { addressPostalCode: parsed.data.addressPostalCode ?? null }
        : {}),
      ...(parsed.data.addressState !== undefined ? { addressState: parsed.data.addressState ?? null } : {}),
      ...(parsed.data.addressCity !== undefined ? { addressCity: parsed.data.addressCity ?? null } : {}),
      ...(parsed.data.addressDistrict !== undefined ? { addressDistrict: parsed.data.addressDistrict ?? null } : {}),
      ...(parsed.data.addressStreet !== undefined ? { addressStreet: parsed.data.addressStreet ?? null } : {}),
      ...(parsed.data.addressNumber !== undefined ? { addressNumber: parsed.data.addressNumber ?? null } : {}),
      ...(parsed.data.addressComplement !== undefined
        ? { addressComplement: parsed.data.addressComplement ?? null }
        : {}),

      ...(parsed.data.address !== undefined ? { address: parsed.data.address ?? null } : {}),
      ...(parsed.data.observations !== undefined ? { observations: parsed.data.observations ?? null } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const client = await prisma.client.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      name: true,
      phone: true,
      phoneCountry: true,
      birthDate: true,
      idType: true,
      idNumber: true,
      idCountry: true,
      addressCountry: true,
      addressPostalCode: true,
      addressState: true,
      addressCity: true,
      addressDistrict: true,
      addressStreet: true,
      addressNumber: true,
      addressComplement: true,
      address: true,
      observations: true,
    },
  })

  return Response.json({ client })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.client.deleteMany({
    where: { id, workspaceId: wsId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
