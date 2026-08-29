import { prisma } from '@/lib/prisma'

const PURCHASE_APPROVAL_THRESHOLD = 1000
const SALES_DISCOUNT_PERCENT_THRESHOLD = 10
const SALES_DISCOUNT_VALUE_THRESHOLD = 200

export function needsPurchaseOrderApproval(estimatedCost: number) {
  return estimatedCost > PURCHASE_APPROVAL_THRESHOLD
}

export function needsSalesOrderDiscountApproval(args: {
  subtotal: number
  total: number
}) {
  const discountValue = Math.max(0, args.subtotal - args.total)
  if (discountValue <= 0) return false
  const discountPercent = args.subtotal > 0 ? (discountValue / args.subtotal) * 100 : 0
  return discountPercent > SALES_DISCOUNT_PERCENT_THRESHOLD || discountValue > SALES_DISCOUNT_VALUE_THRESHOLD
}

export async function ensurePendingApprovalRequest(args: {
  workspaceId: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER'
  entityId: string
  reason: string
  policyKey: string
  amount?: number | null
  requestedById?: string | null
  salesOrderId?: string | null
  purchaseOrderId?: string | null
}) {
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      workspaceId: args.workspaceId,
      entityType: args.entityType,
      entityId: args.entityId,
      policyKey: args.policyKey,
      status: 'PENDING',
    },
    select: { id: true },
  })

  if (existing) return existing

  return prisma.approvalRequest.create({
    data: {
      workspaceId: args.workspaceId,
      entityType: args.entityType,
      entityId: args.entityId,
      reason: args.reason,
      policyKey: args.policyKey,
      amount: args.amount ?? null,
      requestedById: args.requestedById ?? null,
      salesOrderId: args.salesOrderId ?? null,
      purchaseOrderId: args.purchaseOrderId ?? null,
    },
    select: { id: true },
  })
}

export async function hasApprovedApprovalRequest(args: {
  workspaceId: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER'
  entityId: string
  policyKey: string
}) {
  const existing = await prisma.approvalRequest.findFirst({
    where: {
      workspaceId: args.workspaceId,
      entityType: args.entityType,
      entityId: args.entityId,
      policyKey: args.policyKey,
      status: 'APPROVED',
    },
    select: { id: true },
    orderBy: [{ decidedAt: 'desc' }],
  })
  return !!existing
}

