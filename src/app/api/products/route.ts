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

async function ensureWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  if (existing) return existing.workspaceId

  const ws = await prisma.workspace.create({
    data: {
      name: 'Meu espaço',
      members: { create: { userId, role: 'owner' } },
    },
    select: { id: true },
  })
  return ws.id
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const url = new URL(req.url)
  const kind = url.searchParams.get('kind') // RAW | FINISHED | null

  const products = await prisma.product.findMany({
    where: {
      workspaceId: wsId,
      active: true,
      ...(kind ? { kind: kind as any } : {}),
    },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, brand: true, kind: true, unit: true },
  })

  return Response.json({ products })
}

const CreateProductSchema = z.object({
  name: z.string().min(1).max(140),
  brand: z.string().max(140).optional().nullable(),
  kind: z.enum(['RAW', 'FINISHED']).optional(),
  unit: z.string().min(1).max(10),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

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
