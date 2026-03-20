import { describe, it, expect } from 'vitest'
import { formatMoneyFromInput, parseMoneyToNumber } from '@/app/app/money'

describe('money utils', () => {
  it('formatMoneyFromInput keeps last 2 digits as cents (pt-BR)', () => {
    expect(formatMoneyFromInput('1', 'pt-BR')).toBe('0,01')
    expect(formatMoneyFromInput('1234', 'pt-BR')).toBe('12,34')
  })

  it('parseMoneyToNumber parses grouping/decimal for pt-BR', () => {
    expect(parseMoneyToNumber('1.234,56', 'pt-BR')).toBeCloseTo(1234.56)
  })

  it('parseMoneyToNumber parses grouping/decimal for en-US', () => {
    expect(parseMoneyToNumber('1,234.56', 'en-US')).toBeCloseTo(1234.56)
  })
})
