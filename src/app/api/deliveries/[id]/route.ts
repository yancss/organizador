import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { adjustInventory } from '@/lib/inventory-movements'
import { createReceivableForDeliveryOnShipped } from '@/lib/sales/receivables'

const PatchSchema = z.object({
  status: z.enum(['PLANNED', 'PICKING', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'RETURNED']).optional(),
  plannedAt: z.string().datetime().optional().nullable(),
  shippedAt: z.string().datetime().optional().nullable(),
  deliveredAt: z.string().datetime().optional().nullable(),
  carrier: z.string().max(120).optional().nullable(),
  trackingCode: z.string().max(120).optional().nullable(),
  trackingUrl: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
  value: z.coerce.number().positive().optional().nullable(),

  method: z.enum(['DELIVERY', 'PICKUP']).optional(),

  addressCountry: z.string().max(2).optional().nullable(),
  addressPostalCode: z.string().max(16).optional().nullable(),
  addressState: z.string().max(80).optional().nullable(),
  addressCity: z.string().max(120).optional().nullable(),
  addressDistrict: z.string().max(120).optional().nullable(),
  addressStreet: z.string().max(180).optional().nullable(),
  addressNumber: z.string().max(40).optional().nullable(),
  addressComplement: z.string().max(120).optional().nullable(),
  addressNotes: z.string().max(500).optional().nullable(),
})

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  const delivery = await prisma.delivery.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      salesOrderId: true,
      clientId: true,
      status: true,
      method: true,
      plannedAt: true,
      shippedAt: true,
      deliveredAt: true,
      carrier: true,
      trackingCode: true,
      trackingUrl: true,
      observations: true,
      value: true,

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
        select: { id: true, quantity: true, product: { select: { id: true, name: true, unit: true } } },
        orderBy: { createdAt: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
    },
  })

  if (!delivery) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ delivery })
}

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

  const prev = await prisma.delivery.findFirst({
    where: { id, workspaceId: wsId },
    select: {
      id: true,
      status: true,
      method: true,
      addressCity: true,
      addressStreet: true,
      addressCountry: true,
      addressPostalCode: true,
      addressState: true,
      addressDistrict: true,
      addressNumber: true,
      addressComplement: true,
      addressNotes: true,
      items: { select: { productId: true, quantity: true, product: { select: { kind: true } } } },
    },
  })
  if (!prev) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const data: any = {}
  if (parsed.data.status !== undefined) data.status = parsed.data.status
  if (parsed.data.plannedAt !== undefined) data.plannedAt = parsed.data.plannedAt ? new Date(parsed.data.plannedAt) : null
  if (parsed.data.shippedAt !== undefined) data.shippedAt = parsed.data.shippedAt ? new Date(parsed.data.shippedAt) : null
  if (parsed.data.deliveredAt !== undefined)
    data.deliveredAt = parsed.data.deliveredAt ? new Date(parsed.data.deliveredAt) : null
  if (parsed.data.carrier !== undefined) data.carrier = parsed.data.carrier ?? null
  if (parsed.data.trackingCode !== undefined) data.trackingCode = parsed.data.trackingCode ?? null
  if (parsed.data.trackingUrl !== undefined) data.trackingUrl = parsed.data.trackingUrl ?? null
  if (parsed.data.observations !== undefined) data.observations = parsed.data.observations ?? null
  if (parsed.data.value !== undefined) data.value = parsed.data.value ?? null

  if (parsed.data.method !== undefined) data.method = parsed.data.method as any

  const nextMethod = (parsed.data.method ?? prev.method ?? 'PICKUP') as any
  if (nextMethod === 'DELIVERY') {
    const nextCity = parsed.data.addressCity ?? prev.addressCity
    const nextStreet = parsed.data.addressStreet ?? prev.addressStreet
    if (!(nextCity?.trim() && nextStreet?.trim())) {
      return Response.json({ error: 'DELIVERY_ADDRESS_REQUIRED' }, { status: 400 })
    }
  }

  // If method changes to PICKUP, clear address snapshot. If DELIVERY, update provided fields.
  if (parsed.data.method !== undefined && parsed.data.method === 'PICKUP') {
    data.addressCountry = null
    data.addressPostalCode = null
    data.addressState = null
    data.addressCity = null
    data.addressDistrict = null
    data.addressStreet = null
    data.addressNumber = null
    data.addressComplement = null
    data.addressNotes = null
  } else {
    if (parsed.data.addressCountry !== undefined) data.addressCountry = parsed.data.addressCountry ?? null
    if (parsed.data.addressPostalCode !== undefined) data.addressPostalCode = parsed.data.addressPostalCode ?? null
    if (parsed.data.addressState !== undefined) data.addressState = parsed.data.addressState ?? null
    if (parsed.data.addressCity !== undefined) data.addressCity = parsed.data.addressCity ?? null
    if (parsed.data.addressDistrict !== undefined) data.addressDistrict = parsed.data.addressDistrict ?? null
    if (parsed.data.addressStreet !== undefined) data.addressStreet = parsed.data.addressStreet ?? null
    if (parsed.data.addressNumber !== undefined) data.addressNumber = parsed.data.addressNumber ?? null
    if (parsed.data.addressComplement !== undefined) data.addressComplement = parsed.data.addressComplement ?? null
    if (parsed.data.addressNotes !== undefined) data.addressNotes = parsed.data.addressNotes ?? null
  }

  const updated = await prisma.delivery.update({
    where: { id, workspaceId: wsId },
    data,
    select: { id: true, status: true },
  })

  const prevOut = prev.status === 'SHIPPED' || prev.status === 'DELIVERED'
  const nextOut = updated.status === 'SHIPPED' || updated.status === 'DELIVERED'

  // Stock movement for finished products
  if (prevOut !== nextOut) {
    await prisma.$transaction(async (tx) => {
      for (const it of prev.items) {
        // Deliveries should only move finished goods.
        if (it.product.kind !== 'FINISHED') continue
        const qty = Number(it.quantity)
        const delta = nextOut ? -qty : qty
        await adjustInventory(tx as any, { workspaceId: wsId, productId: it.productId, delta })
      }
    })
  }

  // trigger: when becomes SHIPPED, create receivable and apply prepayments
  if (prev.status !== 'SHIPPED' && updated.status === 'SHIPPED') {
    await createReceivableForDeliveryOnShipped({ workspaceId: wsId, deliveryId: id })
  }

  const delivery = await prisma.delivery.findFirst({
    where: { id, workspaceId: wsId },
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

  return Response.json({ delivery })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  // delete delivery (cascade deletes items + receivable)
  const deleted = await prisma.delivery.deleteMany({
    where: { id, workspaceId: wsId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


