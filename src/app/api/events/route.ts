import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  // Compat: /api/events virou um alias para pedidos de venda (SalesOrder).
  const orders = await prisma.salesOrder.findMany({
    where: { workspaceId: wsId, ownerId: auth.user.id },
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      observations: true,
      deliveryAt: true,
      orderedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const events = orders.map((o) => ({
    id: o.id,
    title: o.name,
    notes: o.observations,
    startAt: o.deliveryAt,
    endAt: o.orderedAt,
    allDay: false,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  }))

  return Response.json({ events })
}

const CreateEventSchema = z.object({
  title: z.string().min(1).max(140),
  notes: z.string().max(5000).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const order = await prisma.salesOrder.create({
    data: {
      workspaceId: wsId,
      ownerId: auth.user.id,
      name: parsed.data.title,
      observations: parsed.data.notes ?? null,
      deliveryAt: parsed.data.startAt ? new Date(parsed.data.startAt) : null,
      orderedAt: parsed.data.endAt ? new Date(parsed.data.endAt) : null,
      orderIndex: String(Date.now()),
    },
    select: {
      id: true,
      name: true,
      observations: true,
      deliveryAt: true,
      orderedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const event = {
    id: order.id,
    title: order.name,
    notes: order.observations,
    startAt: order.deliveryAt,
    endAt: order.orderedAt,
    allDay: false,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }

  return Response.json({ event }, { status: 201 })
}

