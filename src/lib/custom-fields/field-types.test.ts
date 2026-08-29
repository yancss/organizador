import { describe, it, expect } from 'vitest'

import { coerceCustomFieldValue, slugifyFieldKey, validateCustomFieldValues } from '@/lib/custom-fields/field-types'

describe('coerceCustomFieldValue', () => {
  it('vazio vira null para qualquer tipo', () => {
    for (const t of ['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT'] as const) {
      expect(coerceCustomFieldValue(t, '')).toEqual({ ok: true, value: null })
      expect(coerceCustomFieldValue(t, null)).toEqual({ ok: true, value: null })
    }
  })

  it('NUMBER e CURRENCY', () => {
    expect(coerceCustomFieldValue('NUMBER', '12,5')).toEqual({ ok: true, value: 12.5 })
    expect(coerceCustomFieldValue('CURRENCY', '10.999')).toEqual({ ok: true, value: 11 })
    expect(coerceCustomFieldValue('NUMBER', 'abc')).toEqual({ ok: false, error: 'NOT_A_NUMBER' })
  })

  it('BOOLEAN aceita variações', () => {
    expect(coerceCustomFieldValue('BOOLEAN', 'sim')).toEqual({ ok: true, value: true })
    expect(coerceCustomFieldValue('BOOLEAN', '0')).toEqual({ ok: true, value: false })
    expect(coerceCustomFieldValue('BOOLEAN', 'talvez')).toEqual({ ok: false, error: 'NOT_A_BOOLEAN' })
  })

  it('DATE normaliza para YYYY-MM-DD', () => {
    expect(coerceCustomFieldValue('DATE', '2026-03-15T10:00:00Z')).toEqual({ ok: true, value: '2026-03-15' })
    expect(coerceCustomFieldValue('DATE', 'nope')).toEqual({ ok: false, error: 'NOT_A_DATE' })
  })

  it('SELECT exige valor da lista', () => {
    expect(coerceCustomFieldValue('SELECT', 'B', ['A', 'B'])).toEqual({ ok: true, value: 'B' })
    expect(coerceCustomFieldValue('SELECT', 'C', ['A', 'B'])).toEqual({ ok: false, error: 'NOT_AN_OPTION' })
  })
})

describe('validateCustomFieldValues', () => {
  const defs = [
    { key: 'garantia', label: 'Garantia', type: 'NUMBER' as const, required: true, options: [] },
    { key: 'cor', label: 'Cor', type: 'STRING' as const, required: false, options: [] },
  ]

  it('ok quando obrigatório preenchido', () => {
    const r = validateCustomFieldValues(defs, { garantia: '12', cor: 'azul' })
    expect(r).toEqual({ ok: true, values: { garantia: 12, cor: 'azul' } })
  })

  it('erro quando obrigatório vazio', () => {
    const r = validateCustomFieldValues(defs, { garantia: '', cor: 'azul' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.garantia).toBe('REQUIRED')
  })

  it('só toca os campos enviados', () => {
    const r = validateCustomFieldValues(defs, { cor: 'verde' })
    // garantia é obrigatório mas não foi enviado -> ainda assim exige (protege PUT parcial)
    expect(r.ok).toBe(false)
  })
})

describe('slugifyFieldKey', () => {
  it('normaliza acentos e espaços', () => {
    expect(slugifyFieldKey('Prazo de Garantia')).toBe('prazo_de_garantia')
    expect(slugifyFieldKey('Nº do contrato!')).toBe('n_do_contrato')
  })
})
