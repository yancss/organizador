import { z } from 'zod'

import { requireAdmin } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const companies = await prisma.company.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: 'asc' },
    include: { branches: { orderBy: { createdAt: 'asc' } } },
  })

  return Response.json({ ok: true, companies })
}

const UpsertSchema = z.object({
  company: z.object({
    id: z.string().optional(),
    legalName: z.string().min(2),
    tradeName: z.string().trim().min(2).optional().nullable(),
    country: z.enum(['BR', 'PT', 'ES']),
  }),
  // For now we upsert a single HQ branch alongside the company.
  hq: z.object({
    id: z.string().optional(),
    code: z.string().trim().min(2).max(32).default('MATRIZ'),
    country: z.enum(['BR', 'PT', 'ES']),
    taxIdType: z.enum(['CNPJ', 'CPF', 'NIF', 'CIF']),
    taxId: z.string().trim().min(5).max(32),

    brIe: z.string().trim().min(2).max(32).optional().nullable(),
    brCrt: z.number().int().optional().nullable(),
    brNfeSeries: z.string().trim().min(1).max(16).optional().nullable(),
    brNfeNextNumber: z.number().int().positive().optional().nullable(),
    brNfeEnvironment: z.enum(['HOMOLOGATION', 'PRODUCTION']).optional().nullable(),

    addressLine1: z.string().trim().min(2).optional().nullable(),
    addressLine2: z.string().trim().min(2).optional().nullable(),
    city: z.string().trim().min(2).optional().nullable(),
    state: z.string().trim().min(2).max(32).optional().nullable(),
    postalCode: z.string().trim().min(3).max(16).optional().nullable(),
  }),
})

export async function PATCH(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const { company, hq } = parsed.data

  const saved = await prisma.$transaction(async (tx) => {
    const c = await tx.company.upsert({
      where: company.id ? { id: company.id } : { id: '__missing__' },
      update: {
        legalName: company.legalName,
        tradeName: company.tradeName ?? null,
        country: company.country,
        updatedById: auth.user.id,
      },
      create: {
        workspaceId: wsId,
        legalName: company.legalName,
        tradeName: company.tradeName ?? null,
        country: company.country,
        createdById: auth.user.id,
        updatedById: auth.user.id,
      },
    }).catch(async () => {
      // If no id was provided, create the first company.
      return tx.company.create({
        data: {
          workspaceId: wsId,
          legalName: company.legalName,
          tradeName: company.tradeName ?? null,
          country: company.country,
          createdById: auth.user.id,
          updatedById: auth.user.id,
        },
      })
    })

    const b = await tx.companyBranch.upsert({
      where: hq.id ? { id: hq.id } : { id: '__missing__' },
      update: {
        code: hq.code,
        country: hq.country,
        taxIdType: hq.taxIdType,
        taxId: hq.taxId,
        brIe: hq.brIe ?? null,
        brCrt: hq.brCrt ?? null,
        brNfeSeries: hq.brNfeSeries ?? null,
        brNfeNextNumber: hq.brNfeNextNumber ?? null,
        brNfeEnvironment: hq.brNfeEnvironment ?? null,
        addressLine1: hq.addressLine1 ?? null,
        addressLine2: hq.addressLine2 ?? null,
        city: hq.city ?? null,
        state: hq.state ?? null,
        postalCode: hq.postalCode ?? null,
        updatedById: auth.user.id,
      },
      create: {
        workspaceId: wsId,
        companyId: c.id,
        type: 'HQ',
        code: hq.code,
        country: hq.country,
        taxIdType: hq.taxIdType,
        taxId: hq.taxId,
        brIe: hq.brIe ?? null,
        brCrt: hq.brCrt ?? null,
        brNfeSeries: hq.brNfeSeries ?? null,
        brNfeNextNumber: hq.brNfeNextNumber ?? null,
        brNfeEnvironment: hq.brNfeEnvironment ?? null,
        addressLine1: hq.addressLine1 ?? null,
        addressLine2: hq.addressLine2 ?? null,
        city: hq.city ?? null,
        state: hq.state ?? null,
        postalCode: hq.postalCode ?? null,
        createdById: auth.user.id,
        updatedById: auth.user.id,
      },
    }).catch(async () => {
      // If no id was provided, upsert by (workspaceId, companyId, code)
      return tx.companyBranch.upsert({
        where: { workspaceId_companyId_code: { workspaceId: wsId, companyId: c.id, code: hq.code } },
        update: {
          country: hq.country,
          taxIdType: hq.taxIdType,
          taxId: hq.taxId,
          brIe: hq.brIe ?? null,
          brCrt: hq.brCrt ?? null,
          brNfeSeries: hq.brNfeSeries ?? null,
          brNfeNextNumber: hq.brNfeNextNumber ?? null,
          brNfeEnvironment: hq.brNfeEnvironment ?? null,
          addressLine1: hq.addressLine1 ?? null,
          addressLine2: hq.addressLine2 ?? null,
          city: hq.city ?? null,
          state: hq.state ?? null,
          postalCode: hq.postalCode ?? null,
          updatedById: auth.user.id,
        },
        create: {
          workspaceId: wsId,
          companyId: c.id,
          type: 'HQ',
          code: hq.code,
          country: hq.country,
          taxIdType: hq.taxIdType,
          taxId: hq.taxId,
          brIe: hq.brIe ?? null,
          brCrt: hq.brCrt ?? null,
          brNfeSeries: hq.brNfeSeries ?? null,
          brNfeNextNumber: hq.brNfeNextNumber ?? null,
          brNfeEnvironment: hq.brNfeEnvironment ?? null,
          addressLine1: hq.addressLine1 ?? null,
          addressLine2: hq.addressLine2 ?? null,
          city: hq.city ?? null,
          state: hq.state ?? null,
          postalCode: hq.postalCode ?? null,
          createdById: auth.user.id,
          updatedById: auth.user.id,
        },
      })
    })

    return { company: c, hq: b }
  })

  return Response.json({ ok: true, ...saved })
}
