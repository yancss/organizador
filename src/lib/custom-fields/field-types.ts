import type { CustomFieldType } from '@prisma/client'

export const CUSTOM_FIELD_TYPES: CustomFieldType[] = ['STRING', 'NUMBER', 'CURRENCY', 'DATE', 'BOOLEAN', 'SELECT', 'RELATION']

export type CustomFieldDefLite = {
  key: string
  label: string
  type: CustomFieldType
  required: boolean
  options: string[]
}

export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string }

/**
 * Valida e normaliza um valor para o tipo do campo.
 * `null`/`''`/`undefined` viram null (vazio). Campos obrigatórios são checados
 * separadamente (validateValues).
 */
export function coerceCustomFieldValue(type: CustomFieldType, raw: unknown, options: string[] = []): CoerceResult {
  if (raw === null || raw === undefined || raw === '') return { ok: true, value: null }

  switch (type) {
    case 'STRING': {
      const s = String(raw).trim()
      if (s.length > 2000) return { ok: false, error: 'TOO_LONG' }
      return { ok: true, value: s || null }
    }
    case 'NUMBER':
    case 'CURRENCY': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
      if (!Number.isFinite(n)) return { ok: false, error: 'NOT_A_NUMBER' }
      return { ok: true, value: type === 'CURRENCY' ? Math.round(n * 100) / 100 : n }
    }
    case 'BOOLEAN': {
      if (typeof raw === 'boolean') return { ok: true, value: raw }
      const s = String(raw).toLowerCase()
      if (['true', '1', 'sim', 'yes', 'si'].includes(s)) return { ok: true, value: true }
      if (['false', '0', 'nao', 'não', 'no'].includes(s)) return { ok: true, value: false }
      return { ok: false, error: 'NOT_A_BOOLEAN' }
    }
    case 'DATE': {
      const d = new Date(String(raw))
      if (Number.isNaN(d.getTime())) return { ok: false, error: 'NOT_A_DATE' }
      // Guarda só a data (YYYY-MM-DD)
      return { ok: true, value: d.toISOString().slice(0, 10) }
    }
    case 'SELECT': {
      const s = String(raw)
      if (!options.includes(s)) return { ok: false, error: 'NOT_AN_OPTION' }
      return { ok: true, value: s }
    }
    case 'RELATION': {
      // Guarda o id do registro alvo. A existência (workspace + objeto) é checada na rota.
      const s = String(raw).trim()
      if (!s) return { ok: true, value: null }
      if (s.length > 200) return { ok: false, error: 'INVALID_REFERENCE' }
      return { ok: true, value: s }
    }
    default:
      return { ok: false, error: 'UNKNOWN_TYPE' }
  }
}

/** Valida um mapa { key: valorBruto } contra as definições. Retorna valores normalizados ou os erros por campo. */
export function validateCustomFieldValues(
  defs: CustomFieldDefLite[],
  input: Record<string, unknown>,
): { ok: true; values: Record<string, unknown> } | { ok: false; errors: Record<string, string> } {
  const values: Record<string, unknown> = {}
  const errors: Record<string, string> = {}

  for (const def of defs) {
    const has = Object.prototype.hasOwnProperty.call(input, def.key)
    const coerced = has ? coerceCustomFieldValue(def.type, input[def.key], def.options) : { ok: true as const, value: null }
    if (!coerced.ok) {
      errors[def.key] = coerced.error
      continue
    }
    if (def.required && (coerced.value === null || coerced.value === undefined)) {
      errors[def.key] = 'REQUIRED'
      continue
    }
    if (has) values[def.key] = coerced.value
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values }
}

/** Gera um slug estável a partir do label (para a `key` do campo). */
export function slugifyFieldKey(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60)
}
