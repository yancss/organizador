import { prisma } from '@/lib/prisma'

/**
 * Política de alçadas por workspace.
 *
 * Os limites nascem parametrizáveis (ERP-GAPS regra 6 / ERP-EXECUTION-AGENTS Agente 4).
 * Ficam guardados em `WorkspaceSetting` sob a chave `approval.policies`; quando não há
 * configuração, valem os defaults abaixo (comportamento histórico).
 */
export const APPROVAL_POLICY_KEY = 'approval.policies'

export type ApprovalPolicy = {
  /** Pedido de compra acima deste custo estimado exige aprovação. */
  purchaseOrderAmountThreshold: number
  /** Desconto de venda acima deste percentual exige aprovação. */
  salesDiscountPercentThreshold: number
  /** Desconto de venda acima deste valor absoluto exige aprovação. */
  salesDiscountValueThreshold: number
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  purchaseOrderAmountThreshold: 1000,
  salesDiscountPercentThreshold: 10,
  salesDiscountValueThreshold: 200,
}

export function coerceApprovalPolicy(raw: unknown): ApprovalPolicy {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const num = (x: unknown, fallback: number) => {
    const n = Number(x)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }
  return {
    purchaseOrderAmountThreshold: num(v.purchaseOrderAmountThreshold, DEFAULT_APPROVAL_POLICY.purchaseOrderAmountThreshold),
    salesDiscountPercentThreshold: num(v.salesDiscountPercentThreshold, DEFAULT_APPROVAL_POLICY.salesDiscountPercentThreshold),
    salesDiscountValueThreshold: num(v.salesDiscountValueThreshold, DEFAULT_APPROVAL_POLICY.salesDiscountValueThreshold),
  }
}

export async function getApprovalPolicy(workspaceId: string): Promise<ApprovalPolicy> {
  const row = await prisma.workspaceSetting.findUnique({
    where: { workspaceId_key: { workspaceId, key: APPROVAL_POLICY_KEY } },
    select: { value: true },
  })
  return coerceApprovalPolicy(row?.value)
}

export function needsPurchaseOrderApproval(
  estimatedCost: number,
  policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY,
) {
  return estimatedCost > policy.purchaseOrderAmountThreshold
}

export function needsSalesOrderDiscountApproval(
  args: {
    subtotal: number
    total: number
  },
  policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY,
) {
  const discountValue = Math.max(0, args.subtotal - args.total)
  if (discountValue <= 0) return false
  const discountPercent = args.subtotal > 0 ? (discountValue / args.subtotal) * 100 : 0
  return (
    discountPercent > policy.salesDiscountPercentThreshold ||
    discountValue > policy.salesDiscountValueThreshold
  )
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
