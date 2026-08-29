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

export function canTransitionSalesQuoteStatus(
  from: SalesQuoteStatus,
  to: SalesQuoteStatus,
  opts?: { allowApproveFromDraft?: boolean },
) {
  if (from === to) return true
  if (opts?.allowApproveFromDraft && from === 'DRAFT' && to === 'APPROVED') return true
  return TRANSITIONS[from]?.includes(to) ?? false
}

/** Reabrir um orçamento recusado/vencido para rascunho. */
export function isReopenTransition(from: SalesQuoteStatus, to: SalesQuoteStatus) {
  return to === 'DRAFT' && (from === 'REJECTED' || from === 'EXPIRED')
}

/** Status em que itens/preços do orçamento ainda podem ser editados. */
export function isEditableQuoteStatus(status: SalesQuoteStatus) {
  return status === 'DRAFT'
}

export function isTerminalQuoteStatus(status: SalesQuoteStatus) {
  return status === 'CONVERTED' || status === 'CANCELLED'
}
