export type Unit = 'kg' | 'g' | 'gr' | 'l' | 'ml' | 'un' | 'dz'

export function normalizeUnit(u: string): Unit | null {
  const v = String(u || '').trim().toLowerCase()
  if (!v) return null
  if (v === 'g') return 'g'
  if (v === 'gr') return 'gr'
  if (v === 'kg') return 'kg'
  if (v === 'l') return 'l'
  if (v === 'ml') return 'ml'
  if (v === 'un') return 'un'
  if (v === 'dz') return 'dz'
  return null
}

export function isConvertible(from: string, to: string) {
  const f = normalizeUnit(from)
  const t = normalizeUnit(to)
  if (!f || !t) return false
  if (f === t) return true

  // treat g and gr as equivalent mass units
  const f2 = f === 'g' ? 'gr' : f
  const t2 = t === 'g' ? 'gr' : t

  const pairs = new Set([
    'kg:gr',
    'gr:kg',
    'l:ml',
    'ml:l',
    'un:dz',
    'dz:un',
  ])

  return pairs.has(`${f2}:${t2}`)
}

export function convertQty(qty: number, fromUnit: string, toUnit: string): number {
  const f0 = normalizeUnit(fromUnit)
  const t0 = normalizeUnit(toUnit)
  if (!f0 || !t0) throw new Error('INVALID_UNIT')

  if (!Number.isFinite(qty)) throw new Error('INVALID_QUANTITY')

  // treat g and gr as the same
  const f = f0 === 'g' ? 'gr' : f0
  const t = t0 === 'g' ? 'gr' : t0

  if (f === t) return qty

  // kg <-> gr
  if (f === 'kg' && t === 'gr') return qty * 1000
  if (f === 'gr' && t === 'kg') return qty / 1000

  // l <-> ml
  if (f === 'l' && t === 'ml') return qty * 1000
  if (f === 'ml' && t === 'l') return qty / 1000

  // un <-> dz
  if (f === 'dz' && t === 'un') return qty * 12
  if (f === 'un' && t === 'dz') return qty / 12

  throw new Error('INCOMPATIBLE_UNITS')
}

export function formatConvertedPreview(args: {
  qtyRaw: string
  fromUnit: string
  toUnit: string
  digits?: number
}): { ok: true; value: number; text: string } | { ok: false; error: string } {
  const digits = args.digits ?? 4
  const qty = Number(String(args.qtyRaw ?? '').replace(',', '.'))
  if (!String(args.qtyRaw ?? '').trim()) return { ok: false, error: 'EMPTY' }
  if (!Number.isFinite(qty)) return { ok: false, error: 'INVALID_QUANTITY' }

  try {
    const v = convertQty(qty, args.fromUnit, args.toUnit)
    const rounded = Number(v.toFixed(digits))
    return { ok: true, value: v, text: `≈ ${rounded} ${args.toUnit}` }
  } catch (e: any) {
    return { ok: false, error: String(e?.message ?? 'ERROR') }
  }
}
