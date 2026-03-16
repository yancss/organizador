import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const purchaseOrders = await prisma.purchaseOrder.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ orderedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      id: true,
      supplier: true,
      status: true,
      orderedAt: true,
      observations: true,
      estimatedCost: true,
      supplierEntity: { select: { id: true, name: true } },
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

  return Response.json({ purchaseOrders })
}

const ItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().positive(),
})

const CreateSchema = z.object({
  supplierId: z.string().min(1),
  supplier: z.any().optional().nullable(),
  orderedAt: z.string().datetime().optional().nullable(),
  status: z.enum(['DRAFT', 'CONFIRMED', 'CANCELLED']).optional(),
  observations: z.string().max(5000).optional().nullable(),
  estimatedCost: z.coerce.number().optional().nullable(),
  items: z.array(ItemSchema).optional(),
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

  // Consolidate items (respect @@unique([purchaseOrderId, productId]))
  const consolidated = new Map<string, number>()
  for (const it of parsed.data.items ?? []) {
    consolidated.set(it.productId, (consolidated.get(it.productId) ?? 0) + Number(it.quantity))
  }

  if (parsed.data.supplier != null) {
    return Response.json({ error: 'SUPPLIER_TEXT_NOT_ALLOWED' }, { status: 400 })
  }

  const supplier = await prisma.client.findFirst({
    where: { id: parsed.data.supplierId, workspaceId: wsId, roles: { has: 'SUPPLIER' } },
    select: { id: true },
  })
  if (!supplier) return Response.json({ error: 'INVALID_SUPPLIER' }, { status: 400 })

  const po = await prisma.purchaseOrder.create({
    data: {
      workspaceId: wsId,
      supplierId: parsed.data.supplierId,
      supplier: null,
      orderedAt: parsed.data.orderedAt ? new Date(parsed.data.orderedAt) : null,
      status: parsed.data.status ?? 'DRAFT',
      observations: parsed.data.observations ?? null,
      estimatedCost: parsed.data.estimatedCost ?? null,
      items: consolidated.size
        ? {
            create: Array.from(consolidated.entries()).map(([productId, quantity]) => ({ productId, quantity })),
          }
        : undefined,
    },
    select: {
      id: true,
      supplier: true,
      status: true,
      orderedAt: true,
      observations: true,
      estimatedCost: true,
      supplierEntity: { select: { id: true, name: true } },
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

  return Response.json({ purchaseOrder: po }, { status: 201 })
}

