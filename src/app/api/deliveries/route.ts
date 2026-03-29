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

      method: true,
      addressCountry: true,
      addressPostalCode: true,
      addressState: true,
      addressCity: true,
      addressDistrict: true,
      addressStreet: true,
      addressNumber: true,
      addressComplement: true,
      addressNotes: true,

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

  method: z.enum(['DELIVERY', 'PICKUP']).optional(),

  plannedAt: z.string().datetime().optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  value: z.coerce.number().positive().optional().nullable(),

  // Address snapshot (required only when method=DELIVERY)
  addressCountry: z.string().max(2).optional().nullable(),
  addressPostalCode: z.string().max(16).optional().nullable(),
  addressState: z.string().max(80).optional().nullable(),
  addressCity: z.string().max(120).optional().nullable(),
  addressDistrict: z.string().max(120).optional().nullable(),
  addressStreet: z.string().max(180).optional().nullable(),
  addressNumber: z.string().max(40).optional().nullable(),
  addressComplement: z.string().max(120).optional().nullable(),
  addressNotes: z.string().max(500).optional().nullable(),

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

  // Validate items products (if provided) belong to workspace and are FINISHED
  if (parsed.data.items?.length) {
    const productIds = [...new Set(parsed.data.items.map((it) => it.productId))]
    const allowed = await prisma.product.findMany({
      where: { workspaceId: wsId, id: { in: productIds }, active: true, kind: 'FINISHED' },
      select: { id: true },
    })
    const allowedSet = new Set(allowed.map((p) => p.id))
    const invalid = productIds.filter((pid) => !allowedSet.has(pid))
    if (invalid.length) return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
  }

  // Validate clientId override (optional)
  if (parsed.data.clientId && parsed.data.clientId !== so.clientId) {
    const ok = await prisma.client.findFirst({ where: { id: parsed.data.clientId, workspaceId: wsId }, select: { id: true } })
    if (!ok) return Response.json({ error: 'CLIENT_NOT_FOUND' }, { status: 404 })
  }

  const method = parsed.data.method ?? 'PICKUP'

  if (method === 'DELIVERY') {
    const ok = !!(parsed.data.addressCity?.trim() && parsed.data.addressStreet?.trim())
    if (!ok) {
      return Response.json({ error: 'DELIVERY_ADDRESS_REQUIRED' }, { status: 400 })
    }
  }

  const delivery = await prisma.delivery.create({
    data: {
      workspaceId: wsId,
      salesOrderId: so.id,
      clientId: parsed.data.clientId ?? so.clientId ?? null,

      method: method as any,

      plannedAt: parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : null,
      observations: parsed.data.observations ?? null,
      value: parsed.data.value ?? null,

      addressCountry: method === 'DELIVERY' ? (parsed.data.addressCountry ?? null) : null,
      addressPostalCode: method === 'DELIVERY' ? (parsed.data.addressPostalCode ?? null) : null,
      addressState: method === 'DELIVERY' ? (parsed.data.addressState ?? null) : null,
      addressCity: method === 'DELIVERY' ? (parsed.data.addressCity ?? null) : null,
      addressDistrict: method === 'DELIVERY' ? (parsed.data.addressDistrict ?? null) : null,
      addressStreet: method === 'DELIVERY' ? (parsed.data.addressStreet ?? null) : null,
      addressNumber: method === 'DELIVERY' ? (parsed.data.addressNumber ?? null) : null,
      addressComplement: method === 'DELIVERY' ? (parsed.data.addressComplement ?? null) : null,
      addressNotes: method === 'DELIVERY' ? (parsed.data.addressNotes ?? null) : null,

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

      method: true,
      addressCountry: true,
      addressPostalCode: true,
      addressState: true,
      addressCity: true,
      addressDistrict: true,
      addressStreet: true,
      addressNumber: true,
      addressComplement: true,
      addressNotes: true,

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

