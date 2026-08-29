import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { nextSalesOrderCode } from '@/lib/sales/sales-order-codes'
import { getSalesQuoteSettings } from '@/lib/sales/sales-quote-settings'

const ORDER_SELECT = {
  id: true,
  code: true,
  name: true,
  status: true,
  value: true,
  client: { select: { id: true, name: true } },
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
} as const

/**
 * F2-02 — Converte um orçamento APROVADO em pedido de venda.
 * O pedido nasce em DRAFT (passa pelo fluxo normal de confirmação/alçada).
 * Idempotente: se o orçamento já foi convertido, devolve o pedido existente.
 */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const quote = await prisma.salesQuote.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      code: true,
      status: true,
      name: true,
      observations: true,
      clientId: true,
      discountMode: true,
      discountType: true,
      discountValue: true,
      discountPercent: true,
      value: true,
      salesOrderId: true,
      items: { select: { productId: true, quantity: true, unitPrice: true, discountType: true, discountValue: true, discountPercent: true } },
    },
  })
  if (!quote) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  if (quote.status === 'CONVERTED' && quote.salesOrderId) {
    const existing = await prisma.salesOrder.findFirst({ where: { id: quote.salesOrderId, workspaceId: wsId }, select: ORDER_SELECT })
    return Response.json({ order: existing, alreadyConverted: true })
  }

  if (quote.status !== 'APPROVED') {
    return Response.json({ error: 'QUOTE_NOT_APPROVED', status: quote.status }, { status: 409 })
  }
  if (!quote.clientId) {
    return Response.json({ error: 'QUOTE_WITHOUT_CLIENT' }, { status: 409 })
  }
  if (!quote.items.length) {
    return Response.json({ error: 'QUOTE_WITHOUT_ITEMS' }, { status: 409 })
  }

  const settings = await getSalesQuoteSettings(wsId)
  const orderStatus = settings.convertedOrderStatus
  const code = await nextSalesOrderCode(wsId)

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        workspaceId: wsId,
        ownerId: auth.user.id,
        createdById: auth.user.id,
        updatedById: auth.user.id,
        code,
        name: quote.name,
        observations: quote.observations ?? null,
        clientId: quote.clientId,
        status: orderStatus,
        discountMode: quote.discountMode,
        discountType: quote.discountType,
        discountValue: quote.discountValue,
        discountPercent: quote.discountPercent,
        value: quote.value,
        orderedAt: new Date(),
        items: {
          create: quote.items.map((it) => ({
            productId: it.productId,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            discountType: it.discountType,
            discountValue: it.discountValue,
            discountPercent: it.discountPercent,
            createdById: auth.user.id,
          })),
        },
      },
      select: ORDER_SELECT,
    })

    await tx.salesQuote.update({
      where: { id: quote.id },
      data: { status: 'CONVERTED', convertedAt: new Date(), salesOrderId: created.id, updatedById: auth.user.id },
      select: { id: true },
    })

    await tx.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'CRUD',
        action: 'UPDATE',
        actorUserId: auth.user.id,
        entityType: 'SalesQuote',
        entityId: quote.id,
        summary: `CONVERT SalesQuote ${quote.code ?? quote.id} -> SalesOrder ${created.code ?? created.id}`,
        changes: { create: [{ field: 'status', from: 'APPROVED', to: 'CONVERTED' }] },
        meta: { via: 'api/quotes/[id]/convert', salesOrderId: created.id },
      },
      select: { id: true },
    })

    await tx.auditEvent.create({
      data: {
        workspaceId: wsId,
        category: 'CRUD',
        action: 'CREATE',
        actorUserId: auth.user.id,
        entityType: 'SalesOrder',
        entityId: created.id,
        summary: `CREATE SalesOrder ${created.code ?? created.id} (de orçamento ${quote.code ?? quote.id})`,
        meta: { via: 'api/quotes/[id]/convert', salesQuoteId: quote.id },
      },
      select: { id: true },
    })

    if (orderStatus !== 'DRAFT') {
      await tx.auditEvent.create({
        data: {
          workspaceId: wsId,
          category: 'CRUD',
          action: 'UPDATE',
          actorUserId: auth.user.id,
          entityType: 'SalesOrder',
          entityId: created.id,
          summary: `STATUS SalesOrder#${created.id}`,
          changes: { create: [{ field: 'status', from: 'DRAFT', to: orderStatus }] },
          meta: { via: 'api/quotes/[id]/convert' },
        },
        select: { id: true },
      })
    }

    return created
  })

  return Response.json({ order }, { status: 201 })
}
