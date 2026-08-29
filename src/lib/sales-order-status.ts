import type { SalesOrderStatus } from '@prisma/client'

const TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  DRAFT: ['SENT', 'CONFIRMED', 'CANCELLED'],
  SENT: ['DRAFT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'],
  APPROVED: ['CONFIRMED', 'CANCELLED'],
  REJECTED: ['DRAFT', 'CANCELLED'],
  EXPIRED: ['DRAFT', 'CANCELLED'],
  CONFIRMED: ['IN_PRODUCTION', 'CANCELLED'],
  IN_PRODUCTION: ['READY', 'CANCELLED'],
  READY: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DONE'],
  DONE: [],
  CANCELLED: [],
}

export function canTransitionSalesOrderStatus(from: SalesOrderStatus, to: SalesOrderStatus) {
  if (from === to) return true
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function isQuoteStatus(status: SalesOrderStatus) {
  return status === 'DRAFT' || status === 'SENT' || status === 'APPROVED' || status === 'REJECTED' || status === 'EXPIRED'
}

