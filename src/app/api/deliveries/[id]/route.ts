import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'
import { adjustInventory } from '@/lib/inventory-movements'
import { createReceivableForDeliveryOnShipped } from '@/lib/sales/receivables'

async function requireUser() {
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    enterWithUser(u.id)
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

async function ensureWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  return existing?.workspaceId ?? null
}

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
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

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
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  // delete delivery (cascade deletes items + receivable)
  const deleted = await prisma.delivery.deleteMany({
    where: { id, workspaceId: wsId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
