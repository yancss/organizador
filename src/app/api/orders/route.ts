import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
// Finance hooks (recebíveis/pagamentos) serão adicionados no próximo passo.

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

type View = 'upcoming' | 'history' | 'all'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const view = (url.searchParams.get('view') ?? 'upcoming') as View

  const today = startOfToday()

  const whereBase = { workspaceId: wsId, ownerId: auth.user.id }

  const where =
    view === 'history'
      ? { ...whereBase, deliveryAt: { lt: today } }
      : view === 'all'
        ? whereBase
        : {
            ...whereBase,
            OR: [{ deliveryAt: null }, { deliveryAt: { gte: today } }],
          }

  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: [{ deliveryAt: 'asc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      status: true,
      orderIndex: true,
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

  return Response.json({ orders })
}

const OrderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const CreateOrderSchema = z.object({
  name: z.string().min(1).max(140),
  observations: z.string().max(5000).optional().nullable(),
  clientId: z.string().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  deliveryAt: z.string().datetime().optional().nullable(),
  // delivered: moved to Deliveries module
  value: z.coerce.number().optional().nullable(),
  items: z.array(OrderItemSchema).optional(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateOrderSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // Garantir que itens do pedido só podem ser produtos finais
  if (parsed.data.items?.length) {
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
    const invalid = productIds.filter((id) => !allowedSet.has(id))
    if (invalid.length) {
      return Response.json({ error: 'INVALID_ITEM_PRODUCT', invalid }, { status: 400 })
    }
  }

  const order = await prisma.salesOrder.create({
    data: {
      workspaceId: wsId,
      ownerId: auth.user.id,
      name: parsed.data.name,
      observations: parsed.data.observations ?? null,
      clientId: parsed.data.clientId ?? null,
      orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
      deliveryAt: parsed.data.deliveryAt ? new Date(parsed.data.deliveryAt) : null,
      status: 'DRAFT',
      value: parsed.data.value ?? null,
      orderIndex: String(Date.now()),
      items: parsed.data.items?.length
        ? {
            create: parsed.data.items.map((it) => ({
              productId: it.productId,
              quantity: it.quantity,
            })),
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
      observations: true,
      orderedAt: true,
      deliveryAt: true,
      status: true,
      orderIndex: true,
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

  // NOTE: Recebível real por expedição + pagamentos antecipados serão implementados no módulo novo.

  return Response.json({ order }, { status: 201 })
}

