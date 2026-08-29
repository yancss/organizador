import { prisma } from '@/lib/prisma'
import { enqueueEmail } from '@/lib/email'
import { canTransitionSalesOrderStatus } from '@/lib/sales-order-status'
import { canTransitionSalesQuoteStatus } from '@/lib/sales/sales-quote-status'
import {
  deletePlannedPayableForPurchaseOrder,
  upsertPayableForPurchaseOrder as upsertDefaultPayable,
} from '@/lib/finance-defaults'
import {
  cancelPayableForPurchaseOrder,
  upsertPayableForPurchaseOrder as upsertDedicatedPayable,
} from '@/lib/payables'

export type DecidedApproval = {
  id: string
  workspaceId: string
  entityType: 'PURCHASE_ORDER' | 'SALES_ORDER' | 'SALES_QUOTE'
  entityId: string
  policyKey: string
  status: 'APPROVED' | 'REJECTED'
  requestedBy?: { id: string; name: string | null; email: string | null } | null
}

export type ApprovalOutcome = {
  advanced: boolean
  status?: string
  reason?: string
  notified: boolean
}

/**
 * Efeito colateral de decidir uma solicitação de aprovação (G7):
 * - quando APROVADA, tenta avançar o pedido bloqueado para CONFIRMED;
 * - notifica o solicitante da decisão (best-effort, nunca quebra o fluxo).
 */
export async function applyApprovalOutcome(
  approval: DecidedApproval,
  actorUserId: string,
): Promise<ApprovalOutcome> {
  let advanced = false
  let status: string | undefined
  let reason: string | undefined

  if (approval.status === 'APPROVED') {
    if (approval.entityType === 'PURCHASE_ORDER' && approval.policyKey === 'PURCHASE_ORDER_AMOUNT') {
      const r = await advancePurchaseOrder(approval.workspaceId, approval.entityId, actorUserId)
      advanced = r.advanced
      status = r.status
      reason = r.reason
    } else if (approval.entityType === 'SALES_ORDER' && approval.policyKey === 'SALES_ORDER_DISCOUNT') {
      const r = await advanceSalesOrder(approval.workspaceId, approval.entityId, actorUserId)
      advanced = r.advanced
      status = r.status
      reason = r.reason
    } else if (approval.entityType === 'SALES_QUOTE' && approval.policyKey === 'SALES_QUOTE_DISCOUNT') {
      const r = await advanceSalesQuote(approval.workspaceId, approval.entityId, actorUserId)
      advanced = r.advanced
      status = r.status
      reason = r.reason
    }
  }

  const notified = await notifyRequester(approval, { advanced, status }).catch(() => false)

  return { advanced, status, reason, notified }
}

async function advancePurchaseOrder(workspaceId: string, purchaseOrderId: string, actorUserId: string) {
  const po = await prisma.purchaseOrder.findFirst({
    where: { id: purchaseOrderId, workspaceId },
    select: { id: true, status: true, estimatedCost: true, orderedAt: true, observations: true, supplierEntity: { select: { id: true } } },
  })
  if (!po) return { advanced: false, reason: 'NOT_FOUND' as const }
  if (po.status !== 'DRAFT') return { advanced: false, status: po.status, reason: 'NOT_DRAFT' as const }

  const value = Number(po.estimatedCost ?? 0)
  if (!Number.isFinite(value) || value <= 0) {
    return { advanced: false, status: po.status, reason: 'ESTIMATED_COST_REQUIRED' as const }
  }

  await prisma.$transaction(async (tx) => {
    await tx.purchaseOrder.update({
      where: { id: po.id },
      data: { status: 'CONFIRMED', updatedById: actorUserId },
      select: { id: true },
    })
    await tx.auditEvent.create({
      data: {
        workspaceId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId,
        entityType: 'PurchaseOrder',
        entityId: po.id,
        summary: `STATUS PurchaseOrder#${po.id}`,
        changes: { create: [{ field: 'status', from: 'DRAFT', to: 'CONFIRMED' }] },
        meta: { via: 'approval:auto-advance' },
      },
      select: { id: true },
    })
  })

  const competenceDate = po.orderedAt ?? new Date()
  await upsertDefaultPayable({ workspaceId, purchaseOrderId: po.id, competenceDate, value })
  await upsertDedicatedPayable({
    workspaceId,
    purchaseOrderId: po.id,
    supplierId: po.supplierEntity?.id ?? null,
    competenceDate,
    plannedAmount: value,
    observations: po.observations ?? null,
  })

  return { advanced: true, status: 'CONFIRMED' as const }
}

async function advanceSalesOrder(workspaceId: string, salesOrderId: string, actorUserId: string) {
  const so = await prisma.salesOrder.findFirst({
    where: { id: salesOrderId, workspaceId },
    select: { id: true, status: true },
  })
  if (!so) return { advanced: false, reason: 'NOT_FOUND' as const }
  if (so.status !== 'DRAFT') return { advanced: false, status: so.status, reason: 'NOT_DRAFT' as const }
  if (!canTransitionSalesOrderStatus('DRAFT', 'CONFIRMED')) {
    return { advanced: false, status: so.status, reason: 'INVALID_TRANSITION' as const }
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: so.id },
      data: { status: 'CONFIRMED', updatedById: actorUserId },
      select: { id: true },
    })
    await tx.auditEvent.create({
      data: {
        workspaceId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId,
        entityType: 'SalesOrder',
        entityId: so.id,
        summary: `STATUS SalesOrder#${so.id}`,
        changes: { create: [{ field: 'status', from: 'DRAFT', to: 'CONFIRMED' }] },
        meta: { via: 'approval:auto-advance' },
      },
      select: { id: true },
    })
  })

  return { advanced: true, status: 'CONFIRMED' as const }
}

async function advanceSalesQuote(workspaceId: string, salesQuoteId: string, actorUserId: string) {
  const quote = await prisma.salesQuote.findFirst({
    where: { id: salesQuoteId, workspaceId },
    select: { id: true, status: true },
  })
  if (!quote) return { advanced: false, reason: 'NOT_FOUND' as const }
  if (quote.status !== 'SENT' && quote.status !== 'DRAFT') {
    return { advanced: false, status: quote.status, reason: 'NOT_PENDING' as const }
  }
  if (!canTransitionSalesQuoteStatus(quote.status, 'APPROVED')) {
    return { advanced: false, status: quote.status, reason: 'INVALID_TRANSITION' as const }
  }

  await prisma.$transaction(async (tx) => {
    await tx.salesQuote.update({
      where: { id: quote.id },
      data: { status: 'APPROVED', decidedAt: new Date(), decidedById: actorUserId, updatedById: actorUserId },
      select: { id: true },
    })
    await tx.auditEvent.create({
      data: {
        workspaceId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId,
        entityType: 'SalesQuote',
        entityId: quote.id,
        summary: `STATUS SalesQuote#${quote.id}`,
        changes: { create: [{ field: 'status', from: quote.status, to: 'APPROVED' }] },
        meta: { via: 'approval:auto-advance' },
      },
      select: { id: true },
    })
  })

  return { advanced: true, status: 'APPROVED' as const }
}

async function notifyRequester(
  approval: DecidedApproval,
  ctx: { advanced: boolean; status?: string },
): Promise<boolean> {
  const email = approval.requestedBy?.email?.trim()
  if (!email) return false

  const kind =
    approval.entityType === 'PURCHASE_ORDER'
      ? 'pedido de compra'
      : approval.entityType === 'SALES_QUOTE'
        ? 'orçamento'
        : 'pedido de venda'
  const decision = approval.status === 'APPROVED' ? 'aprovada' : 'rejeitada'

  const lines = [
    `Sua solicitação de aprovação para o ${kind} foi ${decision}.`,
  ]
  if (approval.status === 'APPROVED') {
    if (approval.entityType === 'SALES_QUOTE') {
      lines.push(ctx.advanced ? 'O orçamento foi marcado como aprovado.' : 'O orçamento pode seguir para aprovação.')
    } else {
      lines.push(
        ctx.advanced
          ? 'O pedido foi confirmado automaticamente.'
          : 'O pedido continua como rascunho e pode ser confirmado normalmente.',
      )
    }
  }

  const subject = `Solicitação ${decision}: ${kind}`
  const text = lines.join('\n')

  const res = await enqueueEmail(
    { to: email, subject, text, html: `<p>${lines.join('</p><p>')}</p>` },
    { kind: 'approval-decision', approvalId: approval.id },
  )
  return res.ok
}
