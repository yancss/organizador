import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  notes: z.string().max(5000).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateEventSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const data: {
    title?: string
    notes?: string | null
    startAt?: Date | null
    endAt?: Date | null
    allDay?: boolean
  } = {}

  if (parsed.data.title !== undefined) data.title = parsed.data.title
  if (parsed.data.notes !== undefined) data.notes = parsed.data.notes ?? null
  if (parsed.data.startAt !== undefined) data.startAt = parsed.data.startAt ? new Date(parsed.data.startAt) : null
  if (parsed.data.endAt !== undefined) data.endAt = parsed.data.endAt ? new Date(parsed.data.endAt) : null
  if (parsed.data.allDay !== undefined) data.allDay = parsed.data.allDay

  const updated = await prisma.salesOrder.updateMany({
    where: { id, workspaceId: wsId, ownerId: auth.user.id },
    data: {
      ...(data.title !== undefined ? { name: data.title } : {}),
      ...(data.notes !== undefined ? { observations: data.notes } : {}),
      ...(data.startAt !== undefined ? { deliveryAt: data.startAt } : {}),
      ...(data.endAt !== undefined ? { orderedAt: data.endAt } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const order = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId, ownerId: auth.user.id },
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

  const event = order
    ? {
        id: order.id,
        title: order.name,
        notes: order.observations,
        startAt: order.deliveryAt,
        endAt: order.orderedAt,
        allDay: false,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      }
    : null

  return Response.json({ event })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const deleted = await prisma.salesOrder.deleteMany({
    where: { id, workspaceId: wsId, ownerId: auth.user.id },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}


