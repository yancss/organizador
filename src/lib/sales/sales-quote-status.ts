import type { SalesQuoteStatus } from '@prisma/client'

const TRANSITIONS: Record<SalesQuoteStatus, SalesQuoteStatus[]> = {
  DRAFT: ['SENT', 'CANCELLED'],
  SENT: ['APPROVED', 'REJECTED', 'EXPIRED', 'DRAFT', 'CANCELLED'],
  APPROVED: ['CONVERTED', 'EXPIRED', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  EXPIRED: ['DRAFT', 'CANCELLED'],
  CONVERTED: [],
  CANCELLED: [],
}

export function canTransitionSalesQuoteStatus(from: SalesQuoteStatus, to: SalesQuoteStatus) {
  if (from === to) return true
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** Status em que itens/preços do orçamento ainda podem ser editados. */
export function isEditableQuoteStatus(status: SalesQuoteStatus) {
  return status === 'DRAFT'
}

export function isTerminalQuoteStatus(status: SalesQuoteStatus) {
  return status === 'CONVERTED' || status === 'CANCELLED'
}
