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

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const recipes = await prisma.recipe.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ updatedAt: 'desc' }],
    select: {
      id: true,
      observations: true,
      yieldQty: true,
      product: { select: { id: true, name: true, unit: true, kind: true } },
      _count: { select: { items: true } },
      updatedAt: true,
      createdAt: true,
    },
  })

  return Response.json({ recipes })
}

const CreateRecipeSchema = z.object({
  productId: z.string().min(1),
  yieldQty: z.coerce.number().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateRecipeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // produto final precisa ser FINISHED
  const finalProduct = await prisma.product.findFirst({
    where: { id: parsed.data.productId, workspaceId: wsId, active: true, kind: 'FINISHED' },
    select: { id: true },
  })
  if (!finalProduct) return Response.json({ error: 'INVALID_FINAL_PRODUCT' }, { status: 400 })

  const recipe = await prisma.recipe.create({
    data: {
      workspaceId: wsId,
      productId: parsed.data.productId,
      yieldQty: parsed.data.yieldQty ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: {
      id: true,
      observations: true,
      yieldQty: true,
      product: { select: { id: true, name: true, unit: true, kind: true } },
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          quantity: true,
          product: { select: { id: true, name: true, unit: true, kind: true } },
        },
      },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ recipe }, { status: 201 })
}
