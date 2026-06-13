import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') // RAW | FINISHED | null
  const q = (url.searchParams.get('q') ?? '').trim()
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 10_000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)
  const skip = (page - 1) * take
  const where = {
    workspaceId: wsId,
    active: true,
    ...(kind ? { kind: kind as any } : {}),
    ...(q.length >= 2
      ? {
          name: {
            contains: q,
            mode: 'insensitive' as const,
          },
        }
      : {}),
  }

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      orderBy: [{ name: 'asc' }],
      skip,
      take,
      select: { id: true, name: true, brand: true, kind: true, unit: true, avgCost: true },
    }),
  ])

  return Response.json({
    products,
    meta: {
      page,
      take,
      total,
      totalPages: Math.max(1, Math.ceil(total / take)),
    },
  })
}

const CreateProductSchema = z.object({
  name: z.string().min(1).max(140),
  brand: z.string().max(140).optional().nullable(),
  kind: z.enum(['RAW', 'INTERMEDIATE', 'FINISHED']).optional(),
  unit: z.string().min(1).max(10),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateProductSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const product = await prisma.product.create({
    data: {
      workspaceId: wsId,
      name: parsed.data.name,
      brand: parsed.data.brand ?? null,
      kind: parsed.data.kind ?? 'RAW',
      unit: parsed.data.unit,
      // Estoque é principalmente para matéria-prima; para produto final pode ficar 0 também.
      inventory: { create: { workspaceId: wsId, quantity: 0 } },
    },
    select: { id: true, name: true, brand: true, kind: true, unit: true },
  })

  return Response.json({ product }, { status: 201 })
}

