import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const BodySchema = z.object({
  code: z.string().min(3).max(64),
  qty: z.coerce.number().positive().optional(),
})

function normalizeCode(code: string) {
  return code.trim().replace(/\s+/g, '')
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id: salesOrderId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const code = normalizeCode(parsed.data.code)
  const qty = parsed.data.qty ?? 1

  // Resolve barcode → product (local only for mutation)
  const local = await prisma.productBarcode.findUnique({
    where: { workspaceId_code: { workspaceId: wsId, code } },
    select: { productId: true, product: { select: { id: true, name: true, unit: true, kind: true, active: true } } },
  })

  if (!local || !local.product || !local.product.active) {
    // best-effort external lookup so UI can show a card
    let external: any = null
    try {
      const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,code`
      const r = await fetch(url, { headers: { 'User-Agent': 'guardian/0.1 (so scan)' }, cache: 'no-store' })
      if (r.ok) {
        const data: any = await r.json()
        if (data?.status === 1 && data.product) {
          external = { code, name: data.product.product_name ?? null, brand: data.product.brands ?? null, quantityText: data.product.quantity ?? null }
        }
      }
    } catch {
      // ignore
    }

    return Response.json({
      result: external ? ('FOUND_EXTERNAL' as const) : ('NOT_FOUND' as const),
      external,
    })
  }

  // Only FINISHED products should be sold
  if (local.product.kind !== 'FINISHED') {
    return Response.json({ error: 'INVALID_ITEM_PRODUCT' }, { status: 400 })
  }

  const order = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrder.findFirst({ where: { id: salesOrderId, workspaceId: wsId }, select: { id: true, status: true } })
    if (!existing) throw new Error('NOT_FOUND')
    if (existing.status === 'DONE' || existing.status === 'CANCELLED') throw new Error('CANNOT_EDIT_ITEMS')

    await tx.salesOrderItem.upsert({
      where: { salesOrderId_productId: { salesOrderId, productId: local.productId } },
      create: {
        salesOrderId,
        productId: local.productId,
        quantity: qty,
        unitPrice: 0,
        createdById: auth.user.id,
      },
      update: {
        quantity: { increment: qty },
        updatedById: auth.user.id,
      },
    })

    return tx.salesOrder.findFirst({
      where: { id: salesOrderId, workspaceId: wsId },
      select: {
        id: true,
        status: true,
        discountMode: true,
        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            discountType: true,
            discountValue: true,
            discountPercent: true,
            product: { select: { id: true, name: true, unit: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })
  })

  if (!order) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({
    result: 'ADDED' as const,
    order,
    product: local.product,
    qty,
  })
}
