import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { calcOrderTotals } from '@/lib/sales-order-totals'
import { normalizeSalesItems } from '@/lib/sales/sales-item-normalization'
import { nextSalesQuoteCode } from '@/lib/sales/sales-quote-codes'

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

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const page = parsePositiveInt(url.searchParams.get('page'), 1, 100000)
  const take = parsePositiveInt(url.searchParams.get('take'), 25, 100)
  const status = (url.searchParams.get('status') ?? '').trim()
  const clientId = (url.searchParams.get('clientId') ?? '').trim()
  const q = (url.searchParams.get('q') ?? '').trim()

  const where = {
    workspaceId: wsId,
    ...(status ? { status: status as any } : {}),
    ...(clientId ? { clientId } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' as const } },
            { code: { contains: q, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  }

  const [total, quotes] = await prisma.$transaction([
    prisma.salesQuote.count({ where }),
    prisma.salesQuote.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }],
      skip: (page - 1) * take,
      take,
      select: QUOTE_SELECT,
    }),
  ])

  return Response.json({
    quotes,
    meta: { page, take, total, totalPages: Math.max(1, Math.ceil(total / take)) },
  })
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

const CreateSchema = z.object({
  name: z.string().min(1).max(140),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().min(1),
  validUntil: z.string().datetime().optional().nullable(),
  discountMode: z.enum(['SUBTOTAL', 'PER_ITEM']).optional(),
  discountType: z.enum(['VALUE', 'PERCENT']).optional().nullable(),
  discountValue: z.coerce.number().optional().nullable(),
  discountPercent: z.coerce.number().optional().nullable(),
  items: z.array(ItemSchema).min(1),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const client = await prisma.client.findFirst({
    where: { id: parsed.data.clientId, workspaceId: wsId },
    select: { id: true },
  })
  if (!client) return Response.json({ error: 'CLIENT_NOT_FOUND' }, { status: 404 })

  const norm = await normalizeSalesItems(wsId, parsed.data.items)
  if (!norm.ok) return Response.json({ error: norm.error, details: norm.details }, { status: norm.status })

  const discountMode = parsed.data.discountMode ?? 'SUBTOTAL'
  const totals = calcOrderTotals({
    items: norm.items,
    discountMode,
    discountType: parsed.data.discountType ?? null,
    discountValue: parsed.data.discountValue,
    discountPercent: parsed.data.discountPercent,
  })

  const code = await nextSalesQuoteCode(wsId)

  const quote = await prisma.salesQuote.create({
    data: {
      workspaceId: wsId,
      ownerId: auth.user.id,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      code,
      name: parsed.data.name,
      observations: parsed.data.observations ?? null,
      clientId: parsed.data.clientId,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      status: 'DRAFT',
      discountMode,
      discountType: parsed.data.discountType ?? null,
      discountValue: parsed.data.discountValue ?? null,
      discountPercent: parsed.data.discountPercent ?? null,
      value: totals.total,
      items: {
        create: norm.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          discountType: discountMode === 'PER_ITEM' ? it.discountType : null,
          discountValue: discountMode === 'PER_ITEM' ? it.discountValue : null,
          discountPercent: discountMode === 'PER_ITEM' ? it.discountPercent : null,
          createdById: auth.user.id,
        })),
      },
    },
    select: QUOTE_SELECT,
  })

  await prisma.auditEvent.create({
    data: {
      workspaceId: wsId,
      category: 'CRUD',
      action: 'CREATE',
      actorUserId: auth.user.id,
      entityType: 'SalesQuote',
      entityId: quote.id,
      summary: `CREATE SalesQuote ${quote.code ?? quote.id}`,
      meta: { via: 'api/quotes POST' },
    },
    select: { id: true },
  })

  return Response.json({ quote }, { status: 201 })
}
