import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { createReceivableForDeliveryOnShipped } from '@/lib/sales/receivables'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const salesOrderId = url.searchParams.get('salesOrderId')

  const deliveries = await prisma.delivery.findMany({
    where: {
      workspaceId: wsId,
      salesOrderId: salesOrderId ?? undefined,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      status: true,
      plannedAt: true,
      shippedAt: true,
      deliveredAt: true,
      carrier: true,
      trackingCode: true,
      trackingUrl: true,
      observations: true,
      value: true,
      receivable: { select: { id: true, status: true, value: true } },
      items: {
        select: {
          id: true,
          quantity: true,
          product: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ deliveries })
}

const DeliveryItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const CreateSchema = z.object({
  salesOrderId: z.string().min(1),
  clientId: z.string().optional().nullable(),
  plannedAt: z.string().datetime().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  value: z.coerce.number().positive().optional().nullable(),
  items: z.array(DeliveryItemSchema).optional(),
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

  // validate sales order exists in workspace
  const so = await prisma.salesOrder.findFirst({
    where: { id: parsed.data.salesOrderId, workspaceId: wsId, ownerId: auth.user.id },
    select: { id: true, clientId: true },
  })
  if (!so) return Response.json({ error: 'SALES_ORDER_NOT_FOUND' }, { status: 404 })

  const delivery = await prisma.delivery.create({
    data: {
      workspaceId: wsId,
      salesOrderId: so.id,
      clientId: parsed.data.clientId ?? so.clientId ?? null,
      plannedAt: parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : null,
      observations: parsed.data.observations ?? null,
      value: parsed.data.value ?? null,
      status: 'PLANNED',
      items: parsed.data.items?.length
        ? {
            create: parsed.data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          }
        : undefined,
    },
    select: { id: true },
  })

  const full = await prisma.delivery.findFirst({
    where: { id: delivery.id, workspaceId: wsId },
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      status: true,
      plannedAt: true,
      shippedAt: true,
      deliveredAt: true,
      carrier: true,
      trackingCode: true,
      trackingUrl: true,
      observations: true,
      value: true,
      items: {
        select: { id: true, quantity: true, product: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: 'asc' },
      },
      receivable: { select: { id: true, status: true, value: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ delivery: full }, { status: 201 })
}

const ShipSchema = z.object({
  status: z.enum(['PLANNED', 'PICKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
  shippedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  carrier: z.string().max(120).optional().nullable(),
  trackingCode: z.string().max(120).optional().nullable(),
  trackingUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  value: z.coerce.number().positive().optional().nullable(),
})

// PATCH is implemented on /api/deliveries/[id]
export const _schemas = { ShipSchema }

