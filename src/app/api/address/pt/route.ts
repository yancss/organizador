import { z } from 'zod'

import { prisma } from '@/lib/prisma'

const CpSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine((v) => /^\d{4}-\d{3}$/.test(v), 'INVALID_POSTAL_CODE_PT')

export async function GET(req: Request) {
  const url = new URL(req.url)
  const cpRaw = url.searchParams.get('cp') ?? ''

  const parsed = CpSchema.safeParse(cpRaw)
  if (!parsed.success) return Response.json({ error: 'INVALID_POSTAL_CODE_PT' }, { status: 400 })

  const cp = parsed.data
  const [cp4, cp3] = cp.split('-') as [string, string]

  const rows = await prisma.postalPt.findMany({
    where: { cp4, cp3 },
    select: { distrito: true, concelho: true, localidade: true },
    orderBy: [{ distrito: 'asc' }, { concelho: 'asc' }],
    take: 25,
  })

  if (!rows.length) {
    return Response.json({ found: false, options: [] })
  }

  // De-duplicate district/council combos
  const options = Array.from(
    new Map(rows.map((r) => [`${r.distrito}__${r.concelho}`, r])).values(),
  ).map((r) => ({ distrito: r.distrito, concelho: r.concelho, localidade: r.localidade ?? null }))

  if (options.length === 1) {
    return Response.json({ found: true, distrito: options[0]!.distrito, concelho: options[0]!.concelho, options })
  }

  return Response.json({ found: true, options })
}
