import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { calcOrderTotals } from '@/lib/sales-order-totals'
import { normalizeSalesItems } from '@/lib/sales/sales-item-normalization'
import { canTransitionSalesQuoteStatus, isEditableQuoteStatus, isReopenTransition } from '@/lib/sales/sales-quote-status'
import { computeQuoteValidUntil, getSalesQuoteSettings } from '@/lib/sales/sales-quote-settings'
import {
  ensurePendingApprovalRequest,
  evaluateSalesDiscount,
  getApprovalPolicy,
  hasApprovedApprovalRequest,
  type WorkspaceActorRole,
} from '@/lib/approval-policies'

const QUOTE_SELECT = {
  id: true,
  code: true,
  name: true,
  observations: true,
  status: true,
  validUntil: true,
  discountMode: true,
  discountType: true,
  discountValue: true,
  discountPercent: true,
  value: true,
  sentAt: true,
  decidedAt: true,
  convertedAt: true,
  salesOrderId: true,
  client: { select: { id: true, name: true } },
  owner: { select: { id: true, name: true, email: true } },
  items: {
    select: {
      id: true,
      quantity: true,
      unitPrice: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      product: { select: { id: true, name: true, unit: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
  salesOrder: { select: { id: true, code: true, status: true } },
  createdAt: true,
  updatedAt: true,
} as const

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const quote = await prisma.salesQuote.findFirst({
    where: { id, workspaceId: auth.user.workspaceId },
    select: QUOTE_SELECT,
  })
  if (!quote) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  return Response.json({ quote })
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative(),
  unit: z.string().optional().nullable(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
})

const PatchSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().min(1).optional(),
  validUntil: z.string().datetime().optional().nullable(),
  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
  items: z.array(ItemSchema).min(1).optional(),
  status: z.enum(['DRAFT', 'SENT', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const prev = await prisma.salesQuote.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      code: true,
      status: true,
      validUntil: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      items: { select: { productId: true, quantity: true, unitPrice: true, discountType: true, discountValue: true, discountPercent: true } },
    },
  })
  if (!prev) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const wantsContentEdit =
    parsed.data.items !== undefined ||
    parsed.data.discountMode !== undefined ||
    parsed.data.discountType !== undefined ||
    parsed.data.discountValue !== undefined ||
    parsed.data.discountPercent !== undefined ||
    parsed.data.name !== undefined ||
    parsed.data.observations !== undefined ||
    parsed.data.clientId !== undefined ||
    parsed.data.validUntil !== undefined

  if (wantsContentEdit && !isEditableQuoteStatus(prev.status)) {
    return Response.json({ error: 'QUOTE_NOT_EDITABLE', status: prev.status }, { status: 409 })
  }

  const quoteSettings = await getSalesQuoteSettings(wsId)
  const isAdmin = auth.user.workspaceRole === 'ADMIN' || auth.user.isSuperadmin === true

  const nextStatus = parsed.data.status ?? prev.status
  if (
    nextStatus !== prev.status &&
    !canTransitionSalesQuoteStatus(prev.status, nextStatus, { allowApproveFromDraft: quoteSettings.allowApproveFromDraft })
  ) {
    return Response.json({ error: 'INVALID_STATUS_TRANSITION', from: prev.status, to: nextStatus }, { status: 400 })
  }

  // Reabrir orçamento recusado/vencido exige perfil de administrador do workspace.
  if (isReopenTransition(prev.status, nextStatus) && !isAdmin) {
    return Response.json({ error: 'REOPEN_REQUIRES_ADMIN' }, { status: 403 })
  }

  // Recompute item/discount data (edit only happens in DRAFT).
  let newItems: Array<{ productId: string; quantity: number; unitPrice: number; discountType: 'VALUE' | 'PERCENT' | null; discountValue: number | null; discountPercent: number | null }> | null = null
  if (parsed.data.items) {
    const client = parsed.data.clientId
      ? await prisma.client.findFirst({ where: { id: parsed.data.clientId, workspaceId: wsId }, select: { id: true } })
      : { id: 'unchanged' }
    if (!client) return Response.json({ error: 'CLIENT_NOT_FOUND' }, { status: 404 })
    const norm = await normalizeSalesItems(wsId, parsed.data.items)
    if (!norm.ok) return Response.json({ error: norm.error, details: norm.details }, { status: norm.status })
    newItems = norm.items
  }

  const discountMode = parsed.data.discountMode ?? prev.discountMode
  const discountType = parsed.data.discountType !== undefined ? parsed.data.discountType : prev.discountType
  const discountValue = parsed.data.discountValue !== undefined ? parsed.data.discountValue : prev.discountValue
  const discountPercent = parsed.data.discountPercent !== undefined ? parsed.data.discountPercent : prev.discountPercent

  const itemsForTotals = (newItems ?? prev.items).map((it) => ({
    quantity: Number(it.quantity),
    unitPrice: Number(it.unitPrice),
    discountType: (it.discountType ?? null) as 'VALUE' | 'PERCENT' | null,
    discountValue: it.discountValue as number | null,
    discountPercent: it.discountPercent as number | null,
  }))
  const totals = calcOrderTotals({
    items: itemsForTotals,
    discountMode: discountMode as 'SUBTOTAL' | 'PER_ITEM',
    discountType: discountType as 'VALUE' | 'PERCENT' | null,
    discountValue: discountValue as number | null,
    discountPercent: discountPercent as number | null,
  })

  // F2-05: alçada comercial escalonada de desconto ao ir para APPROVED.
  if (prev.status !== 'APPROVED' && nextStatus === 'APPROVED') {
    const policy = await getApprovalPolicy(wsId)
    const actorRole: WorkspaceActorRole = auth.user.isSuperadmin
      ? 'SUPERADMIN'
      : auth.user.workspaceRole === 'ADMIN'
        ? 'ADMIN'
        : 'USER'
    const evalResult = evaluateSalesDiscount({ subtotal: totals.subtotal, total: totals.total }, actorRole, policy)

    if (evalResult.decision === 'BLOCKED') {
      return Response.json(
        { error: 'DISCOUNT_EXCEEDS_HARD_CAP', hardCapPercent: evalResult.hardCapPercent, discountPercent: evalResult.discountPercent },
        { status: 400 },
      )
    }
    if (evalResult.decision === 'NEEDS_APPROVAL') {
      const approved = await hasApprovedApprovalRequest({
        workspaceId: wsId,
        entityType: 'SALES_QUOTE',
        entityId: id,
        policyKey: 'SALES_QUOTE_DISCOUNT',
      })
      if (!approved) {
        await ensurePendingApprovalRequest({
          workspaceId: wsId,
          entityType: 'SALES_QUOTE',
          entityId: id,
          policyKey: 'SALES_QUOTE_DISCOUNT',
          reason: 'Orçamento com desconto acima da alçada do responsável',
          amount: evalResult.discountValue,
          requestedById: auth.user.id,
          salesQuoteId: id,
        })
        return Response.json({ error: 'APPROVAL_REQUIRED', policyKey: 'SALES_QUOTE_DISCOUNT' }, { status: 409 })
      }
    }
  }

  const now = new Date()

  // Ao enviar sem validade definida, aplica o prazo padrão do workspace (contado do envio).
  let sentValidUntil: Date | null | undefined
  if (nextStatus === 'SENT' && prev.status !== 'SENT' && prev.validUntil == null && parsed.data.validUntil == null) {
    sentValidUntil = computeQuoteValidUntil(quoteSettings.defaultValidityDays, now)
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (newItems) {
      await tx.salesQuoteItem.deleteMany({ where: { salesQuoteId: id } })
      await tx.salesQuoteItem.createMany({
        data: newItems.map((it) => ({
          salesQuoteId: id,
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountType: discountMode === 'PER_ITEM' ? it.discountType : null,
          discountValue: discountMode === 'PER_ITEM' ? it.discountValue : null,
          discountPercent: discountMode === 'PER_ITEM' ? it.discountPercent : null,
          createdById: auth.user.id,
        })),
      })
    }

    const q = await tx.salesQuote.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.observations !== undefined ? { observations: parsed.data.observations } : {}),
        ...(parsed.data.clientId !== undefined ? { clientId: parsed.data.clientId } : {}),
        ...(parsed.data.validUntil !== undefined ? { validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null } : {}),
        ...(parsed.data.discountMode !== undefined ? { discountMode: parsed.data.discountMode } : {}),
        ...(parsed.data.discountType !== undefined ? { discountType: parsed.data.discountType } : {}),
        ...(parsed.data.discountValue !== undefined ? { discountValue: parsed.data.discountValue } : {}),
        ...(parsed.data.discountPercent !== undefined ? { discountPercent: parsed.data.discountPercent } : {}),
        value: totals.total,
        ...(nextStatus !== prev.status ? { status: nextStatus } : {}),
        ...(nextStatus === 'SENT' && prev.status !== 'SENT' ? { sentAt: now } : {}),
        ...(sentValidUntil !== undefined ? { validUntil: sentValidUntil } : {}),
        ...((nextStatus === 'APPROVED' || nextStatus === 'REJECTED') && prev.status !== nextStatus
          ? { decidedAt: now, decidedById: auth.user.id }
          : {}),
        updatedById: auth.user.id,
      },
      select: QUOTE_SELECT,
    })

    if (nextStatus !== prev.status) {
      await tx.auditEvent.create({
        data: {
          workspaceId: wsId,
          category: 'CRUD',
          action: 'UPDATE',
          actorUserId: auth.user.id,
          entityType: 'SalesQuote',
          entityId: id,
          summary: `STATUS SalesQuote ${prev.code ?? id}`,
          changes: { create: [{ field: 'status', from: prev.status, to: nextStatus }] },
          meta: { via: 'api/quotes/[id] PATCH' },
        },
        select: { id: true },
      })
    }

    return q
  })

  return Response.json({ quote: updated })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const quote = await prisma.salesQuote.findFirst({ where: { id, workspaceId: wsId }, select: { id: true, status: true, code: true } })
  if (!quote) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  if (quote.status !== 'DRAFT' && quote.status !== 'CANCELLED') {
    return Response.json({ error: 'QUOTE_NOT_DELETABLE', status: quote.status }, { status: 409 })
  }

  await prisma.salesQuote.delete({ where: { id } })
  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'CRUD',
      action: 'DELETE',
      actorUserId: auth.user.id,
      entityType: 'SalesQuote',
      entityId: id,
      summary: `DELETE SalesQuote ${quote.code ?? id}`,
      meta: { via: 'api/quotes/[id] DELETE' },
    },
    select: { id: true },
  })

  return Response.json({ ok: true })
}
