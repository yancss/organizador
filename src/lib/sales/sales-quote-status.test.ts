import { describe, it, expect } from 'vitest'

import {
  canTransitionSalesQuoteStatus,
  isEditableQuoteStatus,
  isTerminalQuoteStatus,
} from '@/lib/sales/sales-quote-status'

describe('canTransitionSalesQuoteStatus', () => {
  it('permite o caminho feliz DRAFT -> SENT -> APPROVED -> CONVERTED', () => {
    expect(canTransitionSalesQuoteStatus('DRAFT', 'SENT')).toBe(true)
    expect(canTransitionSalesQuoteStatus('SENT', 'APPROVED')).toBe(true)
    expect(canTransitionSalesQuoteStatus('APPROVED', 'CONVERTED')).toBe(true)
  })

  it('bloqueia atalhos inválidos', () => {
    expect(canTransitionSalesQuoteStatus('DRAFT', 'APPROVED')).toBe(false)
    expect(canTransitionSalesQuoteStatus('DRAFT', 'CONVERTED')).toBe(false)
    expect(canTransitionSalesQuoteStatus('SENT', 'CONVERTED')).toBe(false)
  })

  it('status terminais não saem', () => {
    expect(canTransitionSalesQuoteStatus('CONVERTED', 'DRAFT')).toBe(false)
    expect(canTransitionSalesQuoteStatus('CANCELLED', 'DRAFT')).toBe(false)
    expect(isTerminalQuoteStatus('CONVERTED')).toBe(true)
    expect(isTerminalQuoteStatus('CANCELLED')).toBe(true)
    expect(isTerminalQuoteStatus('APPROVED')).toBe(false)
  })

  it('permite retomar de REJECTED/EXPIRED para DRAFT', () => {
    expect(canTransitionSalesQuoteStatus('REJECTED', 'DRAFT')).toBe(true)
    expect(canTransitionSalesQuoteStatus('EXPIRED', 'DRAFT')).toBe(true)
  })

  it('mesmo status é no-op válido', () => {
    expect(canTransitionSalesQuoteStatus('SENT', 'SENT')).toBe(true)
  })

  it('só DRAFT é editável', () => {
    expect(isEditableQuoteStatus('DRAFT')).toBe(true)
    expect(isEditableQuoteStatus('SENT')).toBe(false)
    expect(isEditableQuoteStatus('APPROVED')).toBe(false)
  })
})
