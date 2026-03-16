import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const AddItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id: recipeId } = await ctx.params

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, workspaceId: wsId },
    select: { id: true },
  })
  if (!recipe) return Response.json({ error: 'RECIPE_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = AddItemSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Item deve ser matéria-prima (RAW)
  const raw = await prisma.product.findFirst({
    where: { id: parsed.data.productId, workspaceId: wsId, active: true, kind: 'RAW' },
    select: { id: true },
  })
  if (!raw) return Response.json({ error: 'INVALID_RAW_PRODUCT' }, { status: 400 })

  const item = await prisma.recipeItem.create({
    data: {
      recipeId,
      productId: parsed.data.productId,
      quantity: parsed.data.quantity,
    },
    select: {
      id: true,
      quantity: true,
      product: { select: { id: true, name: true, unit: true, kind: true } },
      createdAt: true,
    },
  })

  return Response.json({ item }, { status: 201 })
}


