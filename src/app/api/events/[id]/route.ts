import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    // pick first user in DB (or create a default)
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: 'dev@guardian.local',
          name: 'Dev',
          active: true,
          role: 'owner',
        },
        select: { id: true },
      })
    }
    return { ok: true, userId: u.id }
  }

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
  return { ok: true as const, userId }
}

async function userWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  return existing?.workspaceId ?? null
}

const UpdateEventSchema = z.object({
  title: z.string().min(1).max(140).optional(),
  notes: z.string().max(5000).optional().nullable(),
  startAt: z.string().datetime().optional().nullable(),
  endAt: z.string().datetime().optional().nullable(),
  allDay: z.boolean().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

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
    where: { id, workspaceId: wsId, ownerId: auth.userId },
    data: {
      ...(data.title !== undefined ? { name: data.title } : {}),
      ...(data.notes !== undefined ? { observations: data.notes } : {}),
      ...(data.startAt !== undefined ? { deliveryAt: data.startAt } : {}),
      ...(data.endAt !== undefined ? { orderedAt: data.endAt } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const order = await prisma.salesOrder.findFirst({
    where: { id, workspaceId: wsId, ownerId: auth.userId },
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
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.salesOrder.deleteMany({
    where: { id, workspaceId: wsId, ownerId: auth.userId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
