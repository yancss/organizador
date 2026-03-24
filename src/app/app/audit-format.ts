import { formatMoneyDisplay } from './money'

function looksLikeCents(n: unknown) {
  return typeof n === 'number' && Number.isInteger(n) && Math.abs(n) >= 1000
}

export function isMoneyField(field: string) {
  const f = String(field || '')
  return (
    f === 'value' ||
    f.endsWith('.value') ||
    f.endsWith('.unitPrice') ||
    f.endsWith('.discountValue') ||
    f.endsWith('.estimatedCost') ||
    f.endsWith('.openingBalance') ||
    f.endsWith('.avgCost') ||
    f.endsWith('.cost') ||
    f.endsWith('.unitCost')
  )
}

export function formatAuditValue(field: string, v: any, locale: string, currency: any) {
  if (v == null) return '—'

  if (isMoneyField(field)) {
    let n = typeof v === 'number' ? v : Number(String(v))
    if (Number.isFinite(n)) {
      // Heuristic: if audit captured cents-like integer, display as money (÷100)
      if (looksLikeCents(n)) n = n / 100
      return formatMoneyDisplay(n, locale, currency)
    }
  }

  // Pretty status labels (pt only for now; fall back to raw)
  if (field === 'status' || field.endsWith('.status')) {
    const s = String(v)
    const map: Record<string, string> = {
      DRAFT: 'Rascunho',
      CONFIRMED: 'Confirmado',
      IN_PRODUCTION: 'Em produção',
      READY: 'Pronto',
      SHIPPED: 'Enviado',
      DONE: 'Concluído',
      CANCELLED: 'Cancelado',
      OPEN: 'Em aberto',
      PAID: 'Pago',
      PLANNED: 'Planejado',
      RECEIVED: 'Recebido',
    }
    return map[s] ?? s
  }

  if (typeof v === 'string') return v

  try {
    return typeof v === 'object' ? JSON.stringify(v) : String(v)
  } catch {
    return String(v)
  }
}

export function baseFieldLabel(field: string): string {
  const f = String(field || '')
  const map: Record<string, string> = {
    status: 'Status',
    value: 'Valor',
    name: 'Nome',
    observations: 'Observações',
    phone: 'Telefone',
    email: 'E-mail',
    addressCountry: 'País',
    addressPostalCode: 'CEP',
    dueAt: 'Vencimento',
    competenceDate: 'Competência',
    paidAt: 'Pago em',
    accountId: 'Conta',
    categoryId: 'Categoria',
    costCenterId: 'Centro de custo',
  }
  return map[f] ?? f
}
