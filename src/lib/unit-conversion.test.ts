import { describe, it, expect } from 'vitest'
import { convertQty, isConvertible, normalizeUnit, formatConvertedPreview } from '@/lib/unit-conversion'

describe('unit-conversion', () => {
  it('normalizeUnit accepts common units', () => {
    expect(normalizeUnit('KG')).toBe('kg')
    expect(normalizeUnit(' gr ')).toBe('gr')
    expect(normalizeUnit('')).toBeNull()
  })

  it('isConvertible supports kg<->gr, l<->ml, un<->dz and g as alias', () => {
    expect(isConvertible('kg', 'gr')).toBe(true)
    expect(isConvertible('g', 'kg')).toBe(true)
    expect(isConvertible('ml', 'kg')).toBe(false)
  })

  it('convertQty converts quantities correctly', () => {
    expect(convertQty(1, 'kg', 'gr')).toBe(1000)
    expect(convertQty(120, 'un', 'dz')).toBe(10)
  })

  it('formatConvertedPreview returns ok/err', () => {
    expect(formatConvertedPreview({ qtyRaw: '2', fromUnit: 'kg', toUnit: 'gr' })).toMatchObject({ ok: true })
    expect(formatConvertedPreview({ qtyRaw: 'x', fromUnit: 'kg', toUnit: 'gr' })).toMatchObject({ ok: false })
  })
})
