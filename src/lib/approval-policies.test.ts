import { describe, it, expect } from 'vitest'

import {
  DEFAULT_APPROVAL_POLICY,
  coerceApprovalPolicy,
  evaluateSalesDiscount,
  needsPurchaseOrderApproval,
} from '@/lib/approval-policies'

describe('coerceApprovalPolicy', () => {
  it('returns defaults for missing/invalid input', () => {
    expect(coerceApprovalPolicy(null)).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy({})).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy({ purchaseOrderAmountThreshold: -1 })).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy('nonsense')).toEqual(DEFAULT_APPROVAL_POLICY)
  })

  it('keeps valid overrides and falls back per-field', () => {
    const p = coerceApprovalPolicy({ purchaseOrderAmountThreshold: 5000, salesDiscountHardCapPercent: 999 })
    expect(p.purchaseOrderAmountThreshold).toBe(5000)
    expect(p.salesDiscountHardCapPercent).toBe(DEFAULT_APPROVAL_POLICY.salesDiscountHardCapPercent)
  })

  it('mapeia a chave legada salesDiscountPercentThreshold para o limite do papel USER', () => {
    const p = coerceApprovalPolicy({ salesDiscountPercentThreshold: 7 })
    expect(p.salesDiscountMaxByRole.USER).toBe(7)
    expect(p.salesDiscountMaxByRole.ADMIN).toBe(DEFAULT_APPROVAL_POLICY.salesDiscountMaxByRole.ADMIN)
  })

  it('aceita salesDiscountMaxByRole explícito', () => {
    const p = coerceApprovalPolicy({ salesDiscountMaxByRole: { USER: 5, ADMIN: 20 } })
    expect(p.salesDiscountMaxByRole).toEqual({ USER: 5, ADMIN: 20 })
  })
})

describe('needsPurchaseOrderApproval', () => {
  it('uses the default threshold when no policy is passed', () => {
    expect(needsPurchaseOrderApproval(1000)).toBe(false)
    expect(needsPurchaseOrderApproval(1000.01)).toBe(true)
  })

  it('respects a custom per-workspace threshold', () => {
    const policy = coerceApprovalPolicy({ purchaseOrderAmountThreshold: 5000 })
    expect(needsPurchaseOrderApproval(4000, policy)).toBe(false)
    expect(needsPurchaseOrderApproval(6000, policy)).toBe(true)
  })
})

describe('evaluateSalesDiscount', () => {
  const policy = coerceApprovalPolicy({
    salesDiscountMaxByRole: { USER: 10, ADMIN: 25 },
    salesDiscountValueThreshold: 200,
    salesDiscountHardCapPercent: 40,
  })

  it('sem desconto sempre libera', () => {
    expect(evaluateSalesDiscount({ subtotal: 100, total: 100 }, 'USER', policy).decision).toBe('ALLOW')
  })

  it('vendedor: dentro do limite libera, acima escala', () => {
    expect(evaluateSalesDiscount({ subtotal: 100, total: 92 }, 'USER', policy).decision).toBe('ALLOW') // 8%
    expect(evaluateSalesDiscount({ subtotal: 100, total: 85 }, 'USER', policy).decision).toBe('NEEDS_APPROVAL') // 15%
  })

  it('admin tem alçada maior que o vendedor', () => {
    expect(evaluateSalesDiscount({ subtotal: 100, total: 85 }, 'ADMIN', policy).decision).toBe('ALLOW') // 15% <= 25%
    expect(evaluateSalesDiscount({ subtotal: 100, total: 70 }, 'ADMIN', policy).decision).toBe('NEEDS_APPROVAL') // 30% > 25%
  })

  it('acima do teto rígido é bloqueado para qualquer papel (é limite de negócio, não de permissão)', () => {
    expect(evaluateSalesDiscount({ subtotal: 100, total: 55 }, 'ADMIN', policy).decision).toBe('BLOCKED') // 45% > 40%
    expect(evaluateSalesDiscount({ subtotal: 100, total: 55 }, 'SUPERADMIN', policy).decision).toBe('BLOCKED')
  })

  it('superadmin não escala por % abaixo do teto', () => {
    expect(evaluateSalesDiscount({ subtotal: 100, total: 65 }, 'SUPERADMIN', policy).decision).toBe('ALLOW') // 35% < 40%
  })

  it('valor absoluto acima do limite escala mesmo com % baixo', () => {
    expect(evaluateSalesDiscount({ subtotal: 10000, total: 9700 }, 'USER', policy).decision).toBe('NEEDS_APPROVAL') // 3% mas 300 abs
  })
})
