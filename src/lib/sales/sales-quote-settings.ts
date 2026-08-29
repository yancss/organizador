import { prisma } from '@/lib/prisma'

/**
 * Configuração comercial do orçamento, por workspace (chave `sales.quote` em
 * `WorkspaceSetting`).
 */
export const SALES_QUOTE_SETTINGS_KEY = 'sales.quote'

export type SalesQuoteSettings = {
  /** Dias de validade aplicados quando o orçamento é criado sem data explícita. 0 = sem validade padrão. */
  defaultValidityDays: number
  /** Permite pular o status SENT e aprovar direto do rascunho. */
  allowApproveFromDraft: boolean
  /** Status inicial do pedido de venda gerado na conversão. */
  convertedOrderStatus: 'DRAFT' | 'CONFIRMED'
  /** Move automaticamente orçamentos SENT/APPROVED vencidos para EXPIRED (cron). */
  autoExpire: boolean
  /** Dias de antecedência do lembrete de vencimento por e-mail. 0 = sem lembrete. */
  reminderDaysBefore: number
}

export const DEFAULT_SALES_QUOTE_SETTINGS: SalesQuoteSettings = {
  defaultValidityDays: 15,
  allowApproveFromDraft: false,
  convertedOrderStatus: 'DRAFT',
  autoExpire: true,
  reminderDaysBefore: 3,
}

export function coerceSalesQuoteSettings(raw: unknown): SalesQuoteSettings {
  const v = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const d = DEFAULT_SALES_QUOTE_SETTINGS

  const intInRange = (x: unknown, fallback: number, min: number, max: number) => {
    const n = Number(x)
    return Number.isFinite(n) && n >= min && n <= max ? Math.floor(n) : fallback
  }

  return {
    defaultValidityDays: intInRange(v.defaultValidityDays, d.defaultValidityDays, 0, 3650),
    allowApproveFromDraft: typeof v.allowApproveFromDraft === 'boolean' ? v.allowApproveFromDraft : d.allowApproveFromDraft,
    convertedOrderStatus: v.convertedOrderStatus === 'CONFIRMED' ? 'CONFIRMED' : d.convertedOrderStatus,
    autoExpire: typeof v.autoExpire === 'boolean' ? v.autoExpire : d.autoExpire,
    reminderDaysBefore: intInRange(v.reminderDaysBefore, d.reminderDaysBefore, 0, 365),
  }
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
