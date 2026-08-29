import { prisma } from '@/lib/prisma'

/**
 * Política de alçadas por workspace.
 *
 * Os limites nascem parametrizáveis (ERP-GAPS regra 6 / ERP-EXECUTION-AGENTS Agente 4).
 * Ficam guardados em `WorkspaceSetting` sob a chave `approval.policies`; quando não há
 * configuração, valem os defaults abaixo (comportamento histórico).
 */
export const APPROVAL_POLICY_KEY = 'approval.policies'

export type WorkspaceActorRole = 'USER' | 'ADMIN' | 'SUPERADMIN'

export type ApprovalPolicy = {
  /** Pedido de compra acima deste custo estimado exige aprovação. */
  purchaseOrderAmountThreshold: number
  /** Desconto de venda acima deste valor absoluto exige aprovação (independe do papel). */
  salesDiscountValueThreshold: number
  /** Desconto máximo (%) que cada papel pode conceder sem escalar para aprovação. */
  salesDiscountMaxByRole: { USER: number; ADMIN: number }
  /** Desconto (%) acima deste teto é recusado de vez (nem com aprovação). */
  salesDiscountHardCapPercent: number
}

export const DEFAULT_APPROVAL_POLICY: ApprovalPolicy = {
  purchaseOrderAmountThreshold: 1000,
  salesDiscountValueThreshold: 200,
  salesDiscountMaxByRole: { USER: 10, ADMIN: 25 },
  salesDiscountHardCapPercent: 40,
}

export function coerceApprovalPolicy(raw: unknown): ApprovalPolicy {
  const v = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const d = DEFAULT_APPROVAL_POLICY
  const num = (x: unknown, fallback: number) => {
    const n = Number(x)
    return Number.isFinite(n) && n >= 0 ? n : fallback
  }
  const pct = (x: unknown, fallback: number) => {
    const n = Number(x)
    return Number.isFinite(n) && n >= 0 && n <= 100 ? n : fallback
  }

  const byRoleRaw = (v.salesDiscountMaxByRole && typeof v.salesDiscountMaxByRole === 'object'
    ? v.salesDiscountMaxByRole
    : {}) as Record<string, unknown>

  // Compat: chave antiga `salesDiscountPercentThreshold` vira o limite do papel USER.
  const legacyUser = pct(v.salesDiscountPercentThreshold, d.salesDiscountMaxByRole.USER)

  const user = 'USER' in byRoleRaw ? pct(byRoleRaw.USER, d.salesDiscountMaxByRole.USER) : legacyUser
  const admin =
    'ADMIN' in byRoleRaw ? pct(byRoleRaw.ADMIN, d.salesDiscountMaxByRole.ADMIN) : Math.max(d.salesDiscountMaxByRole.ADMIN, user)

  return {
    purchaseOrderAmountThreshold: num(v.purchaseOrderAmountThreshold, d.purchaseOrderAmountThreshold),
    salesDiscountValueThreshold: num(v.salesDiscountValueThreshold, d.salesDiscountValueThreshold),
    salesDiscountMaxByRole: { USER: user, ADMIN: admin },
    salesDiscountHardCapPercent: pct(v.salesDiscountHardCapPercent, d.salesDiscountHardCapPercent),
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

export type SalesDiscountDecision = 'ALLOW' | 'NEEDS_APPROVAL' | 'BLOCKED'

export type SalesDiscountEvaluation = {
  decision: SalesDiscountDecision
  discountValue: number
  discountPercent: number
  /** Limite (%) do papel do ator, para mensagem/telemetria. */
  roleLimitPercent: number
  hardCapPercent: number
}

function roleDiscountLimit(policy: ApprovalPolicy, role: WorkspaceActorRole): number {
  if (role === 'SUPERADMIN') return 100
  return policy.salesDiscountMaxByRole[role] ?? policy.salesDiscountMaxByRole.USER
}

/**
 * Alçada comercial escalonada: dado o desconto e o papel de quem está agindo,
 * decide se libera, se precisa de aprovação de alguém com mais alçada, ou se
 * está acima do teto e deve ser recusado.
 */
export function evaluateSalesDiscount(
  args: { subtotal: number; total: number },
  role: WorkspaceActorRole,
  policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY,
): SalesDiscountEvaluation {
  const discountValue = Math.max(0, args.subtotal - args.total)
  const discountPercent = args.subtotal > 0 ? (discountValue / args.subtotal) * 100 : 0
  const roleLimitPercent = roleDiscountLimit(policy, role)
  const hardCapPercent = policy.salesDiscountHardCapPercent

  let decision: SalesDiscountDecision = 'ALLOW'
  if (discountValue > 0) {
    if (discountPercent > hardCapPercent + 1e-9) {
      decision = 'BLOCKED'
    } else if (discountPercent > roleLimitPercent + 1e-9 || discountValue > policy.salesDiscountValueThreshold) {
      decision = 'NEEDS_APPROVAL'
    }
  }

  return { decision, discountValue, discountPercent, roleLimitPercent, hardCapPercent }
}

/** Retrocompat: mantém a assinatura booleana usada em pontos que ainda não passam o papel. */
export function needsSalesOrderDiscountApproval(
  args: { subtotal: number; total: number },
  policy: ApprovalPolicy = DEFAULT_APPROVAL_POLICY,
  role: WorkspaceActorRole = 'USER',
) {
  return evaluateSalesDiscount(args, role, policy).decision === 'NEEDS_APPROVAL'
}

export async function ensurePendingApprovalRequest(args: {
  workspaceId: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'SALES_QUOTE'
  entityId: string
  reason: string
  policyKey: string
  amount?: number | null
  requestedById?: string | null
  salesOrderId?: string | null
  purchaseOrderId?: string | null
  salesQuoteId?: string | null
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
      salesQuoteId: args.salesQuoteId ?? null,
    },
    select: { id: true },
  })
}

export async function hasApprovedApprovalRequest(args: {
  workspaceId: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'SALES_QUOTE'
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
