import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'
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
  if (existing) return existing.workspaceId

  const ws = await prisma.workspace.create({
    data: { name: 'Meu espaço', members: { create: { userId, role: 'owner' } } },
    select: { id: true },
  })
  return ws.id
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

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
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // validate sales order exists in workspace
  const so = await prisma.salesOrder.findFirst({
    where: { id: parsed.data.salesOrderId, workspaceId: wsId, ownerId: auth.userId },
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
