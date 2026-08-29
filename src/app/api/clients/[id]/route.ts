import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const SupplierWeekdaySchema = z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'])
const BlockedDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)

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

  entityType: z.enum(['PERSON', 'COMPANY']).optional(),

  roles: z.array(z.enum(['CUSTOMER', 'SUPPLIER'])).optional().nullable(),

  phone: E164Like.optional().nullable(),
  phoneCountry: z.string().length(2).optional().nullable(),
  email: z.string().email().max(254).optional().nullable(),

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
  supplierOrderDays: z.array(SupplierWeekdaySchema).optional().nullable(),
  supplierDeliveryDays: z.array(SupplierWeekdaySchema).optional().nullable(),
  supplierOrderCutoffHour: z.coerce.number().int().min(0).max(23).optional().nullable(),
  supplierBlockedDates: z.array(BlockedDateSchema).optional().nullable(),
  supplierMinOrderValue: z.coerce.number().positive().optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateClientSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.client.updateMany({
    where: { id, workspaceId: wsId },
    data: {
      updatedById: auth.user.id,
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.entityType !== undefined ? { entityType: parsed.data.entityType } : {}),
      ...(parsed.data.roles !== undefined ? { roles: parsed.data.roles?.length ? parsed.data.roles : ['CUSTOMER'] } : {}),

      ...(parsed.data.phone !== undefined ? { phone: parsed.data.phone ?? null } : {}),
      ...(parsed.data.phoneCountry !== undefined ? { phoneCountry: parsed.data.phoneCountry ?? null } : {}),
      ...(parsed.data.email !== undefined ? { email: parsed.data.email ?? null } : {}),

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
      ...(parsed.data.supplierOrderDays !== undefined ? { supplierOrderDays: parsed.data.supplierOrderDays ?? [] } : {}),
      ...(parsed.data.supplierDeliveryDays !== undefined ? { supplierDeliveryDays: parsed.data.supplierDeliveryDays ?? [] } : {}),
      ...(parsed.data.supplierOrderCutoffHour !== undefined ? { supplierOrderCutoffHour: parsed.data.supplierOrderCutoffHour ?? null } : {}),
      ...(parsed.data.supplierBlockedDates !== undefined ? { supplierBlockedDates: parsed.data.supplierBlockedDates ?? [] } : {}),
      ...(parsed.data.supplierMinOrderValue !== undefined ? { supplierMinOrderValue: parsed.data.supplierMinOrderValue ?? null } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const client = await prisma.client.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      createdAt: true,
      updatedAt: true,
      createdById: true,
      updatedById: true,
      name: true,
      entityType: true,
      roles: true,
      phone: true,
      phoneCountry: true,
      email: true,
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
      supplierOrderDays: true,
      supplierDeliveryDays: true,
      supplierOrderCutoffHour: true,
      supplierBlockedDates: true,
      supplierMinOrderValue: true,
    },
  })

  return Response.json({ client })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const deleted = await prisma.client.deleteMany({
    where: { id, workspaceId: wsId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


