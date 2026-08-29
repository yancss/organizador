import { describe, it, expect } from 'vitest'

import {
  DEFAULT_SALES_QUOTE_SETTINGS,
  coerceSalesQuoteSettings,
  computeQuoteValidUntil,
} from '@/lib/sales/sales-quote-settings'

describe('coerceSalesQuoteSettings', () => {
  it('usa o default para entrada ausente/inválida', () => {
    expect(coerceSalesQuoteSettings(null)).toEqual(DEFAULT_SALES_QUOTE_SETTINGS)
    expect(coerceSalesQuoteSettings({})).toEqual(DEFAULT_SALES_QUOTE_SETTINGS)
    expect(coerceSalesQuoteSettings({ defaultValidityDays: -1 })).toEqual(DEFAULT_SALES_QUOTE_SETTINGS)
    expect(coerceSalesQuoteSettings({ defaultValidityDays: 'x' })).toEqual(DEFAULT_SALES_QUOTE_SETTINGS)
    expect(coerceSalesQuoteSettings({ defaultValidityDays: 99999 })).toEqual(DEFAULT_SALES_QUOTE_SETTINGS)
  })

  it('aceita override válido e trunca decimais', () => {
    expect(coerceSalesQuoteSettings({ defaultValidityDays: 30 }).defaultValidityDays).toBe(30)
    expect(coerceSalesQuoteSettings({ defaultValidityDays: 7.9 }).defaultValidityDays).toBe(7)
    expect(coerceSalesQuoteSettings({ defaultValidityDays: 0 }).defaultValidityDays).toBe(0)
  })

  it('aceita os toggles de ciclo de vida', () => {
    const s = coerceSalesQuoteSettings({ allowApproveFromDraft: true, convertedOrderStatus: 'CONFIRMED', autoExpire: false, reminderDaysBefore: 7 })
    expect(s).toMatchObject({ allowApproveFromDraft: true, convertedOrderStatus: 'CONFIRMED', autoExpire: false, reminderDaysBefore: 7 })
  })

  it('convertedOrderStatus inválido volta ao default', () => {
    expect(coerceSalesQuoteSettings({ convertedOrderStatus: 'BOGUS' }).convertedOrderStatus).toBe('DRAFT')
  })
})

describe('computeQuoteValidUntil', () => {
  const base = new Date('2026-01-10T12:00:00.000Z')

  it('soma os dias à data base', () => {
    expect(computeQuoteValidUntil(15, base)?.toISOString().slice(0, 10)).toBe('2026-01-25')
  })

  it('retorna null quando o prazo é 0 ou negativo', () => {
    expect(computeQuoteValidUntil(0, base)).toBeNull()
    expect(computeQuoteValidUntil(-5, base)).toBeNull()
  })
})
