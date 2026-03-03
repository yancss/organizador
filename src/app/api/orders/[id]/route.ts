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

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const UpdateOrderSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  deliveryAt: z.string().datetime().optional().nullable(),
  delivered: z.boolean().optional(),
  value: z.coerce.number().optional().nullable(),
  items: z.array(OrderItemSchema).optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const data: any = {}
  if (parsed.data.name !== undefined) data.name = parsed.data.name
  if (parsed.data.observations !== undefined) data.observations = parsed.data.observations ?? null
  if (parsed.data.clientId !== undefined) data.clientId = parsed.data.clientId ?? null
  if (parsed.data.orderedAt !== undefined) data.orderedAt = parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null
  if (parsed.data.deliveryAt !== undefined) data.deliveryAt = parsed.data.deliveryAt ? new Date(parsed.data.deliveryAt) : null
  if (parsed.data.delivered !== undefined) data.delivered = parsed.data.delivered
  if (parsed.data.value !== undefined) data.value = parsed.data.value ?? null

  const updated = await prisma.order.updateMany({
    where: { id, workspaceId: wsId, ownerId: auth.userId },
    data,
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  // Itens: estratégia simples (MVP) = substituir tudo.
  if (parsed.data.items) {
    // Garantir que itens do pedido só podem ser produtos finais
    if (parsed.data.items.length) {
      const productIds = [...new Set(parsed.data.items.map((it) => it.productId))]
      const allowed = await prisma.product.findMany({
        where: {
          workspaceId: wsId,
          id: { in: productIds },
          active: true,
          kind: 'FINISHED',
        },
        select: { id: true },
      })
      const allowedSet = new Set(allowed.map((p) => p.id))
      const invalid = productIds.filter((pid) => !allowedSet.has(pid))
      if (invalid.length) {
        return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
      }
    }

    await prisma.orderItem.deleteMany({ where: { orderId: id } })
    if (parsed.data.items.length) {
      await prisma.orderItem.createMany({
        data: parsed.data.items.map((it) => ({
          orderId: id,
          productId: it.productId,
          quantity: it.quantity,
        })),
      })
    }
  }

  const order = await prisma.order.findFirst({
    where: { id, workspaceId: wsId, ownerId: auth.userId },
    select: {
      id: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      delivered: true,
      value: true,
      client: { select: { id: true, name: true } },
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

  return Response.json({ order })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id } = await ctx.params

  const deleted = await prisma.order.deleteMany({
    where: { id, workspaceId: wsId, ownerId: auth.userId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
