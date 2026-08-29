import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'
import { consumeInventoryLots, registerInventoryLotReceipt } from '@/lib/inventory-lots'
import { ensureDefaultWarehouse } from '@/lib/stock-locations'

const CreateSchema = z.object({
  recipeId: z.string().min(1),
  producedQty: z.coerce.number().positive(),
  date: z.string().datetime().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

function makeProductionLotCode(recipeId: string, at: Date) {
  const y = at.getFullYear()
  const m = String(at.getMonth() + 1).padStart(2, '0')
  const d = String(at.getDate()).padStart(2, '0')
  const hh = String(at.getHours()).padStart(2, '0')
  const mm = String(at.getMinutes()).padStart(2, '0')
  return `PROD-${y}${m}${d}-${hh}${mm}-${recipeId.slice(0, 6).toUpperCase()}`
}

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
      items: { select: { productId: true, quantity: true, product: { select: { kind: true, name: true } } } },
      product: { select: { kind: true } },
    },
  })
  if (!recipe) return Response.json({ error: 'RECIPE_NOT_FOUND' }, { status: 404 })

  if (recipe.product.kind !== 'FINISHED' && recipe.product.kind !== 'INTERMEDIATE') {
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
      const defaultWarehouse = await ensureDefaultWarehouse(tx as any, wsId, auth.user.id)
      // Build consumption list (RAW + INTERMEDIATE)
      const consumed: Array<{ productId: string; required: number }> = []

      for (const it of recipe.items) {
        if (it.product.kind !== 'RAW' && it.product.kind !== 'INTERMEDIATE') continue
        const required = Number(it.quantity) * factor
        if (!Number.isFinite(required) || required <= 0) continue
        consumed.push({ productId: it.productId, required })
      }

      // Fetch avgCost for all consumed products
      const prodRows = consumed.length
        ? await tx.product.findMany({
            where: { workspaceId: wsId, id: { in: consumed.map((c) => c.productId) }, active: true },
            select: { id: true, name: true, avgCost: true },
          })
        : []
      const avgById = new Map(prodRows.map((p) => [p.id, p.avgCost == null ? 0 : Number(p.avgCost)]))
      const nameById = new Map(prodRows.map((p) => [p.id, p.name]))

      // Block production if any consumed ingredient has no avgCost
      const missingCost = consumed.find((c) => {
        const avg = avgById.get(c.productId) ?? 0
        return !(Number.isFinite(avg) && avg > 0)
      })
      if (missingCost) {
        const ingredientName = nameById.get(missingCost.productId) ?? recipe.items.find((x) => x.productId === missingCost.productId)?.product?.name
        throw {
          code: 'MISSING_INGREDIENT_COST',
          ingredientId: missingCost.productId,
          ingredientName: ingredientName ?? null,
        }
      }

      // Consume inventory + record consumption, and compute batch cost
      let batchCost = 0
      for (const c of consumed) {
        const avg = avgById.get(c.productId) ?? 0
        batchCost += c.required * avg

        await consumeInventoryLots(tx as any, {
          workspaceId: wsId,
          productId: c.productId,
          warehouseId: defaultWarehouse.id,
          quantity: c.required,
          eventType: 'PRODUCTION_CONSUMPTION',
          referenceType: 'Recipe',
          referenceId: recipe.id,
          notes: parsed.data.observations ?? null,
        })

        await adjustInventory(tx as any, {
          workspaceId: wsId,
          productId: c.productId,
          delta: -c.required,
          userId: auth.user.id,
          movementType: 'PRODUCTION_CONSUMPTION',
          referenceType: 'Recipe',
          referenceId: recipe.id,
          observations: parsed.data.observations ?? null,
        })

        await tx.consumption.create({
          data: {
            workspaceId: wsId,
            date: at,
            productId: c.productId,
            quantity: c.required,
            recipeId: recipe.id,
            observations: parsed.data.observations ?? null,
          },
          select: { id: true },
        })
      }

      // Produce output
      const producedQty = Number(parsed.data.producedQty)
      if (!Number.isFinite(producedQty) || producedQty <= 0) throw new Error('INVALID_PRODUCED_QTY')

      // Calculate unit cost for produced product
      const unitCostProduced = batchCost / producedQty

      // Update inventory first
      const invBefore = await tx.inventory.findUnique({ where: { productId: recipe.productId }, select: { quantity: true } })
      const productBefore = await tx.product.findFirst({ where: { id: recipe.productId, workspaceId: wsId }, select: { avgCost: true } })

      const currentQty = invBefore?.quantity == null ? 0 : Number(invBefore.quantity)
      const currentAvg = productBefore?.avgCost == null ? 0 : Number(productBefore.avgCost)

      await adjustInventory(tx as any, {
        workspaceId: wsId,
        productId: recipe.productId,
        delta: producedQty,
        userId: auth.user.id,
        movementType: 'PRODUCTION_OUTPUT',
        referenceType: 'Recipe',
        referenceId: recipe.id,
        observations: parsed.data.observations ?? null,
        unitCost: unitCostProduced,
      })

      await registerInventoryLotReceipt(tx as any, {
        workspaceId: wsId,
        productId: recipe.productId,
        warehouseId: defaultWarehouse.id,
        lotCode: makeProductionLotCode(recipe.id, at),
        expiresAt: null,
        quantity: producedQty,
        notes: parsed.data.observations ?? 'Production output batch.',
        userId: auth.user.id,
        eventType: 'PRODUCTION_OUTPUT',
        referenceType: 'Recipe',
        referenceId: recipe.id,
      })

      // Weighted average cost for produced product
      const denom = currentQty + producedQty
      const nextAvg = denom > 0 ? (currentQty * currentAvg + producedQty * unitCostProduced) / denom : unitCostProduced

      await tx.product.update({ where: { id: recipe.productId }, data: { avgCost: nextAvg } })

      return { ok: true, batchCost, unitCostProduced }
    })

    return Response.json(result, { status: 201 })
  } catch (err: any) {
    // Custom structured errors (thrown from transaction)
    if (err?.code === 'MISSING_INGREDIENT_COST') {
      return Response.json(
        {
          error: 'MISSING_INGREDIENT_COST',
          ingredientId: err.ingredientId ?? null,
          ingredientName: err.ingredientName ?? null,
        },
        { status: 409 },
      )
    }

    const msg = String(err?.message ?? err)
    if (msg.includes('INSUFFICIENT_STOCK')) return Response.json({ error: 'INSUFFICIENT_STOCK' }, { status: 409 })
    if (msg.includes('MISSING_INGREDIENT_COST')) return Response.json({ error: 'MISSING_INGREDIENT_COST' }, { status: 409 })
    if (msg.includes('INVALID_PRODUCT')) return Response.json({ error: 'INVALID_PRODUCT' }, { status: 400 })
    return Response.json({ error: 'FAILED', details: msg }, { status: 500 })
  }
}

