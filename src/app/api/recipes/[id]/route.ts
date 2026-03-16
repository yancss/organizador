import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const recipe = await prisma.recipe.findFirst({
    where: { id, workspaceId: wsId },
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

  if (!recipe) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ recipe })
}

const UpdateRecipeSchema = z.object({
  productId: z.string().min(1).optional(),
  yieldQty: z.coerce.number().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateRecipeSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  if (parsed.data.productId) {
    const finalProduct = await prisma.product.findFirst({
      where: { id: parsed.data.productId, workspaceId: wsId, active: true, kind: 'FINISHED' },
      select: { id: true },
    })
    if (!finalProduct) return Response.json({ error: 'INVALID_FINAL_PRODUCT' }, { status: 400 })
  }

  const updated = await prisma.recipe.updateMany({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.productId !== undefined ? { productId: parsed.data.productId } : {}),
      ...(parsed.data.yieldQty !== undefined ? { yieldQty: parsed.data.yieldQty ?? null } : {}),
      ...(parsed.data.observations !== undefined ? { observations: parsed.data.observations ?? null } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const recipe = await prisma.recipe.findFirst({
    where: { id, workspaceId: wsId },
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

  return Response.json({ recipe })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.recipe.deleteMany({ where: { id, workspaceId: wsId } })
  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}



