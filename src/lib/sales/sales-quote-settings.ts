import { prisma } from '@/lib/prisma'

/**
 * Configuração comercial do orçamento, por workspace (chave `sales.quote` em
 * `WorkspaceSetting`). Hoje só o prazo de validade padrão.
 */
export const SALES_QUOTE_SETTINGS_KEY = 'sales.quote'

export type SalesQuoteSettings = {
  /** Dias de validade aplicados quando o orçamento é criado sem data explícita. 0 = sem validade padrão. */
  defaultValidityDays: number
}

export const DEFAULT_SALES_QUOTE_SETTINGS: SalesQuoteSettings = {
  defaultValidityDays: 15,
}

export function coerceSalesQuoteSettings(raw: unknown): SalesQuoteSettings {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const n = Number(v.defaultValidityDays)
  const days = Number.isFinite(n) && n >= 0 && n <= 3650 ? Math.floor(n) : DEFAULT_SALES_QUOTE_SETTINGS.defaultValidityDays
  return { defaultValidityDays: days }
}

export async function getSalesQuoteSettings(workspaceId: string): Promise<SalesQuoteSettings> {
  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId, key: SALES_QUOTE_SETTINGS_KEY } },
    select: { value: true },
  })
  return coerceSalesQuoteSettings(row?.value)
}

/** Retorna a data de validade a partir do prazo em dias (null se prazo <= 0). */
export function computeQuoteValidUntil(days: number, from: Date = new Date()): Date | null {
  if (!Number.isFinite(days) || days <= 0) return null
  const d = new Date(from)
  d.setDate(d.getDate() + Math.floor(days))
  return d
}
