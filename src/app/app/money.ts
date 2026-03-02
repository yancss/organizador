import type { AppCurrency, AppLanguage } from './settings-context'

export function localeFromLanguage(language: AppLanguage): string {
  if (language === 'pt') return 'pt-BR'
  if (language === 'es') return 'es-ES'
  // keep English predictable for money formatting
  return 'en-US'
}

export function formatMoneyFromNumber(value: number, locale: string): string {
  // For input masking: no currency symbol, just grouping/decimal.
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatMoneyFromInput(raw: string, locale: string): string {
  // Accept anything, keep only digits; last 2 digits are cents.
  const digits = (raw ?? '').replace(/\D/g, '')
  if (!digits) return ''

  const cents = Number(digits)
  if (!Number.isFinite(cents)) return ''

  return formatMoneyFromNumber(cents / 100, locale)
}

function separatorsForLocale(locale: string): { group: string; decimal: string } {
  // 1000.1 -> group + decimal in that locale
  const parts = new Intl.NumberFormat(locale).formatToParts(1000.1)
  const group = parts.find((p) => p.type === 'group')?.value ?? ','
  const decimal = parts.find((p) => p.type === 'decimal')?.value ?? '.'
  return { group, decimal }
}

export function parseMoneyToNumber(masked: string, locale: string): number | null {
  const v = (masked ?? '').trim()
  if (!v) return null

  const { group, decimal } = separatorsForLocale(locale)

  // Remove grouping and normalize decimal separator.
  const normalized = v
    .replaceAll(group, '')
    .replaceAll(decimal, '.')
    // Remove any stray spaces/currency symbols
    .replace(/[^0-9.\-]/g, '')

  const n = Number(normalized)
  if (!Number.isFinite(n)) return null
  return n
}

export function formatMoneyDisplay(value: string | number, locale: string, currency: AppCurrency): string {
  const n = typeof value === 'number' ? value : Number(String(value))
  if (!Number.isFinite(n)) return String(value)
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)
}
