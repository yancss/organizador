import { prisma } from '@/lib/prisma'
import { convertQty, convertUnitPrice, isConvertible, normalizeUnit } from '@/lib/unit-conversion'

export type RawSalesItemInput = {
  productId: string
  quantity: number
  unitPrice: number
  unit?: string | null
  discountType?: 'VALUE' | 'PERCENT' | null
  discountValue?: number | null
  discountPercent?: number | null
}

export type NormalizedSalesItem = {
  productId: string
  quantity: number
  unitPrice: number
  discountType: 'VALUE' | 'PERCENT' | null
  discountValue: number | null
  discountPercent: number | null
}

export type NormalizeResult =
  | { ok: true; items: NormalizedSalesItem[] }
  | { ok: false; status: number; error: string; details?: unknown }

/**
 * Valida que os produtos pertencem ao workspace, são FINISHED e ativos,
 * e normaliza quantidade/preço para a unidade base de cada produto.
 * Compartilhado entre pedido de venda e orçamento.
 */
export async function normalizeSalesItems(
  workspaceId: string,
  rawItems: RawSalesItemInput[],
): Promise<NormalizeResult> {
  const productIds = [...new Set(rawItems.map((it) => it.productId))]
  const products = await prisma.product.findMany({
    where: { workspaceId, id: { in: productIds }, active: true, kind: 'FINISHED' },
    select: { id: true, unit: true },
  })
  const unitById = new Map(products.map((p) => [p.id, p.unit]))
  const invalid = productIds.filter((id) => !unitById.has(id))
  if (invalid.length) return { ok: false, status: 400, error: 'INVALID_ITEM_PRODUCT', details: { invalid } }

  const consolidated = new Map<string, NormalizedSalesItem>()
  for (const it of rawItems) {
    const baseUnitRaw = unitById.get(it.productId)
    const baseUnit = baseUnitRaw ? normalizeUnit(baseUnitRaw) : null
    if (!baseUnit) return { ok: false, status: 400, error: 'INVALID_PRODUCT_UNIT', details: { productId: it.productId } }

    const inputUnit = it.unit ? normalizeUnit(it.unit) : null
    const u = inputUnit ?? baseUnit
    if (!isConvertible(u, baseUnit)) {
      return { ok: false, status: 400, error: 'INVALID_UNIT_CONVERSION', details: { productId: it.productId, from: u, to: baseUnit } }
    }

    const quantity = convertQty(Number(it.quantity), u, baseUnit)
    const unitPrice = convertUnitPrice(Number(it.unitPrice), u, baseUnit)
    const prev = consolidated.get(it.productId)
    const next: NormalizedSalesItem = {
      productId: it.productId,
      quantity: (prev?.quantity ?? 0) + quantity,
      unitPrice: prev?.unitPrice ?? unitPrice,
      discountType: (it.discountType ?? prev?.discountType) ?? null,
      discountValue: it.discountValue ?? prev?.discountValue ?? null,
      discountPercent: it.discountPercent ?? prev?.discountPercent ?? null,
    }
    consolidated.set(it.productId, next)
  }

  return { ok: true, items: [...consolidated.values()] }
}
