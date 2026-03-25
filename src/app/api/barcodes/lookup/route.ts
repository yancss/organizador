import { NextRequest } from 'next/server'
import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const QuerySchema = z.object({
  code: z.string().min(3).max(64),
})

function normalizeCode(code: string) {
  return code.trim().replace(/\s+/g, '')
}

export async function GET(req: NextRequest) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { searchParams } = new URL(req.url)
  const parsed = QuerySchema.safeParse({ code: searchParams.get('code') ?? '' })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', details: parsed.error.flatten() }, { status: 400 })
  }

  const code = normalizeCode(parsed.data.code)

  const local = await prisma.productBarcode.findUnique({
    where: { workspaceId_code: { workspaceId: wsId, code } },
    select: {
      id: true,
      code: true,
      source: true,
      externalRef: true,
      product: { select: { id: true, name: true, brand: true, unit: true, kind: true, active: true } },
    },
  })

  if (local) {
    return Response.json({
      result: 'FOUND_LOCAL' as const,
      barcode: { id: local.id, code: local.code, source: local.source, externalRef: local.externalRef },
      product: local.product,
    })
  }

  // Not found locally → try Open Food Facts (best-effort)
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,quantity,code,product_quantity,product_quantity_unit`
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'guardian/0.1 (barcode lookup)',
      },
      // keep Next from caching for too long; this is interactive
      cache: 'no-store',
    })

    if (!r.ok) {
      return Response.json({ result: 'NOT_FOUND' as const })
    }

    const data: any = await r.json()
    if (!data || data.status !== 1 || !data.product) {
      return Response.json({ result: 'NOT_FOUND' as const })
    }

    const p = data.product

    return Response.json({
      result: 'FOUND_EXTERNAL' as const,
      external: {
        code,
        name: p.product_name ?? null,
        brand: p.brands ?? null,
        quantityText: p.quantity ?? null,
        productQuantity: p.product_quantity ?? null,
        productQuantityUnit: p.product_quantity_unit ?? null,
        source: 'OPEN_FOOD_FACTS' as const,
      },
    })
  } catch {
    return Response.json({ result: 'NOT_FOUND' as const })
  }
}
