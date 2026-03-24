import type { DiscountType, Prisma } from '@prisma/client'

export type Money = Prisma.Decimal | number | string | null | undefined

function toNumber(v: Money): number {
  if (v == null) return 0
  if (typeof v === 'number') return v
  if (typeof v === 'string') return Number(v)
  // Prisma.Decimal
  return Number(v)
}

export function clampPercent(p: number): number {
  if (!Number.isFinite(p)) return 0
  return Math.max(0, Math.min(100, p))
}

export function calcDiscountAmount(args: { base: number; type: DiscountType | null; value?: Money; percent?: Money }): number {
  const base = Number(args.base) || 0
  const type = args.type ?? null
  if (!type) return 0
  if (type === 'VALUE') return Math.max(0, toNumber(args.value))
  const p = clampPercent(toNumber(args.percent))
  return Math.max(0, (base * p) / 100)
}

export function calcLineTotals(args: {
  quantity: Money
  unitPrice: Money
  discountType?: DiscountType | null
  discountValue?: Money
  discountPercent?: Money
}): { subtotal: number; discount: number; total: number } {
  const qty = Math.max(0, toNumber(args.quantity))
  const unit = Math.max(0, toNumber(args.unitPrice))
  const subtotal = qty * unit
  const discount = Math.min(subtotal, calcDiscountAmount({ base: subtotal, type: args.discountType ?? null, value: args.discountValue, percent: args.discountPercent }))
  const total = Math.max(0, subtotal - discount)
  return { subtotal, discount, total }
}

export function calcOrderTotals(args: {
  items: Array<{ quantity: Money; unitPrice: Money; discountType?: DiscountType | null; discountValue?: Money; discountPercent?: Money }>
  discountMode: 'SUBTOTAL' | 'PER_ITEM'
  discountType?: DiscountType | null
  discountValue?: Money
  discountPercent?: Money
}): { subtotal: number; discount: number; total: number } {
  const lines = args.items.map((it) => calcLineTotals(it))
  const subtotal = lines.reduce((a, b) => a + b.subtotal, 0)

  // Money in this app is stored/displayed with 2 decimals.
  // Use rounding to avoid audit noise caused by floating-point artifacts.
  const round2 = (n: number) => Math.round((Number(n) + Number.EPSILON) * 100) / 100

  if (args.discountMode === 'PER_ITEM') {
    const discount = lines.reduce((a, b) => a + b.discount, 0)
    const total = Math.max(0, subtotal - discount)
    return { subtotal: round2(subtotal), discount: round2(discount), total: round2(total) }
  }

  const discount = Math.min(
    subtotal,
    calcDiscountAmount({ base: subtotal, type: args.discountType ?? null, value: args.discountValue, percent: args.discountPercent }),
  )
  const total = Math.max(0, subtotal - discount)
  return { subtotal: round2(subtotal), discount: round2(discount), total: round2(total) }
}
