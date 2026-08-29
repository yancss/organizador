import { describe, it, expect } from 'vitest'

import {
  DEFAULT_APPROVAL_POLICY,
  coerceApprovalPolicy,
  needsPurchaseOrderApproval,
  needsSalesOrderDiscountApproval,
} from '@/lib/approval-policies'

describe('coerceApprovalPolicy', () => {
  it('returns defaults for missing/invalid input', () => {
    expect(coerceApprovalPolicy(null)).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy({})).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy({ purchaseOrderAmountThreshold: -1 })).toEqual(DEFAULT_APPROVAL_POLICY)
    expect(coerceApprovalPolicy('nonsense')).toEqual(DEFAULT_APPROVAL_POLICY)
  })

  it('keeps valid overrides and falls back per-field', () => {
    expect(
      coerceApprovalPolicy({ purchaseOrderAmountThreshold: 5000, salesDiscountPercentThreshold: 'x' }),
    ).toEqual({
      purchaseOrderAmountThreshold: 5000,
      salesDiscountPercentThreshold: DEFAULT_APPROVAL_POLICY.salesDiscountPercentThreshold,
      salesDiscountValueThreshold: DEFAULT_APPROVAL_POLICY.salesDiscountValueThreshold,
    })
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

describe('needsSalesOrderDiscountApproval', () => {
  it('no discount never needs approval', () => {
    expect(needsSalesOrderDiscountApproval({ subtotal: 100, total: 100 })).toBe(false)
  })

  it('default: over 10% or over 200 absolute triggers approval', () => {
    expect(needsSalesOrderDiscountApproval({ subtotal: 100, total: 91 })).toBe(false) // 9%
    expect(needsSalesOrderDiscountApproval({ subtotal: 100, total: 89 })).toBe(true) // 11%
    expect(needsSalesOrderDiscountApproval({ subtotal: 10000, total: 9750 })).toBe(true) // 2.5% but 250 abs
  })

  it('respects custom per-workspace thresholds', () => {
    const policy = coerceApprovalPolicy({ salesDiscountPercentThreshold: 30, salesDiscountValueThreshold: 100000 })
    expect(needsSalesOrderDiscountApproval({ subtotal: 100, total: 80 }, policy)).toBe(false) // 20% < 30%
    expect(needsSalesOrderDiscountApproval({ subtotal: 100, total: 60 }, policy)).toBe(true) // 40% > 30%
  })
})
