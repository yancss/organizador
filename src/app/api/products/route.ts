import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') // RAW | FINISHED | null
  const q = (url.searchParams.get('q') ?? '').trim()

  const products = await prisma.product.findMany({
    where: {
      workspaceId: wsId,
      active: true,
      ...(kind ? { kind: kind as any } : {}),
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
    select: { id: true, name: true, brand: true, kind: true, unit: true, avgCost: true },
  })

  return Response.json({ products })
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

