import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'

const CreateSchema = z.object({
  recipeId: z.string().min(1),
  producedQty: z.coerce.number().positive(),
  date: z.string().datetime().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

// Option A: explicit production command.
// - Decrement RAW items (Consumption)
// - Increment FINISHED product
export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const recipe = await prisma.recipe.findFirst({
    where: { id: parsed.data.recipeId, workspaceId: wsId },
    select: {
      id: true,
      productId: true,
      yieldQty: true,
      items: { select: { productId: true, quantity: true, product: { select: { kind: true } } } },
      product: { select: { kind: true } },
    },
  })
  if (!recipe) return Response.json({ error: 'RECIPE_NOT_FOUND' }, { status: 404 })

  if (recipe.product.kind !== 'FINISHED') {
    return Response.json({ error: 'INVALID_RECIPE_OUTPUT_PRODUCT' }, { status: 400 })
  }

  const yieldQty = recipe.yieldQty == null ? null : Number(recipe.yieldQty)
  if (!yieldQty || !Number.isFinite(yieldQty) || yieldQty <= 0) {
    return Response.json({ error: 'RECIPE_YIELD_REQUIRED' }, { status: 400 })
  }

  const factor = parsed.data.producedQty / yieldQty

  const at = parsed.data.date ? new Date(parsed.data.date) : new Date()

  try {
    const result = await prisma.$transaction(async (tx) => {
      // consume RAW
      for (const it of recipe.items) {
        if (it.product.kind !== 'RAW') continue
        const required = Number(it.quantity) * factor
        if (!Number.isFinite(required) || required <= 0) continue

        await adjustInventory(tx as any, { workspaceId: wsId, productId: it.productId, delta: -required })

        await tx.consumption.create({
          data: {
            workspaceId: wsId,
            date: at,
            productId: it.productId,
            quantity: required,
            recipeId: recipe.id,
            observations: parsed.data.observations ?? null,
          },
          select: { id: true },
        })
      }

      // produce FINISHED
      await adjustInventory(tx as any, { workspaceId: wsId, productId: recipe.productId, delta: parsed.data.producedQty })

      return { ok: true }
    })

    return Response.json(result, { status: 201 })
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (msg.includes('INSUFFICIENT_STOCK')) return Response.json({ error: 'INSUFFICIENT_STOCK' }, { status: 409 })
    if (msg.includes('INVALID_PRODUCT')) return Response.json({ error: 'INVALID_PRODUCT' }, { status: 400 })
    return Response.json({ error: 'FAILED', details: msg }, { status: 500 })
  }
}

