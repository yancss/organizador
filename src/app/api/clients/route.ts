import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()

  const clients = await prisma.client.findMany({
    where: {
      workspaceId: wsId,
      ...(q.length >= 2
        ? {
            name: {
              contains: q,
              mode: 'insensitive',
            },
          }
        : {}),
    },
    orderBy: [{ name: 'asc' }],
    take: q.length >= 2 ? 25 : 500,
    select: {
      id: true,
      name: true,
      roles: true,
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

  return Response.json({ clients })
}

function normalizeE164(input: string) {
  // Keep only leading + and digits
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

const CreateClientSchema = z.object({
  name: z.string().min(1).max(140),

  roles: z.array(z.enum(['CUSTOMER', 'SUPPLIER'])).optional().nullable(),

  // Contact
  phone: E164Like.optional().nullable(),
  phoneCountry: z.string().length(2).optional().nullable(),

  // Personal
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), // YYYY-MM-DD

  // Identification
  idType: z.string().max(32).optional().nullable(),
  idNumber: z.string().max(64).optional().nullable(),
  idCountry: z.string().length(2).optional().nullable(),

  // Address (structured)
  addressCountry: z.string().length(2).optional().nullable(),
  addressPostalCode: z.string().max(16).optional().nullable(),
  addressState: z.string().max(80).optional().nullable(),
  addressCity: z.string().max(120).optional().nullable(),
  addressDistrict: z.string().max(120).optional().nullable(),
  addressStreet: z.string().max(180).optional().nullable(),
  addressNumber: z.string().max(32).optional().nullable(),
  addressComplement: z.string().max(180).optional().nullable(),

  // Legacy
  address: z.string().max(500).optional().nullable(),

  observations: z.string().max(5000).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateClientSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const client = await prisma.client.create({
    data: {
      workspaceId: wsId,
      name: parsed.data.name,
      roles: parsed.data.roles?.length ? parsed.data.roles : ['CUSTOMER'],

      phone: parsed.data.phone ?? null,
      phoneCountry: parsed.data.phoneCountry ?? null,

      birthDate: parsed.data.birthDate ? new Date(parsed.data.birthDate) : null,

      idType: parsed.data.idType ?? null,
      idNumber: parsed.data.idNumber ?? null,
      idCountry: parsed.data.idCountry ?? null,

      addressCountry: parsed.data.addressCountry ?? null,
      addressPostalCode: parsed.data.addressPostalCode ?? null,
      addressState: parsed.data.addressState ?? null,
      addressCity: parsed.data.addressCity ?? null,
      addressDistrict: parsed.data.addressDistrict ?? null,
      addressStreet: parsed.data.addressStreet ?? null,
      addressNumber: parsed.data.addressNumber ?? null,
      addressComplement: parsed.data.addressComplement ?? null,

      address: parsed.data.address ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: {
      id: true,
      name: true,
      roles: true,
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

  return Response.json({ client }, { status: 201 })
}

