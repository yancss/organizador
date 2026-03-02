import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
  return { ok: true as const, userId }
}

async function ensureWorkspace(userId: string) {
  // One personal workspace per user for MVP
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    include: { workspace: true },
  })
  if (existing) return existing.workspace

  const ws = await prisma.workspace.create({
    data: {
      name: 'Meu espaço',
      members: { create: { userId, role: 'owner' } },
    },
  })
  return ws
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)

  // Compat: /api/events virou um alias para pedidos.
  const orders = await prisma.order.findMany({
    where: { workspaceId: ws.id, ownerId: auth.userId },
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
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateEventSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const order = await prisma.order.create({
    data: {
      workspaceId: ws.id,
      ownerId: auth.userId,
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
