import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { upsertPayableForPurchase } from '@/lib/finance-defaults'

const CreateSchema = z.object({
  productId: z.string().min(1),
  date: z.string().datetime().optional().nullable(),
  quantity: z.coerce.number().positive(),
  cost: z.coerce.number().optional().nullable(),
  supplier: z.string().max(140).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),

  // payment control
  paid: z.boolean().optional(),
})

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const purchases = await prisma.purchase.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      date: true,
      quantity: true,
      cost: true,
      supplier: true,
      observations: true,
      product: { select: { id: true, name: true, unit: true } },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ purchases })
}

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  // product must be RAW
  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, workspaceId: wsId, active: true, kind: 'RAW' },
    select: { id: true },
  })
  if (!product) return Response.json({ error: 'INVALID_PRODUCT' }, { status: 400 })

  const purchase = await prisma.purchase.create({
    data: {
      workspaceId: wsId,
      productId: parsed.data.productId,
      date: parsed.data.date ? new Date(parsed.data.date) : new Date(),
      quantity: parsed.data.quantity,
      cost: parsed.data.cost ?? null,
      supplier: parsed.data.supplier ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: { id: true, date: true, quantity: true, cost: true, supplier: true, observations: true },
  })

  // Create/Update accounts payable entry (OUT). If paid=true, status becomes PAID.
  const paid = parsed.data.paid ?? false
  if (purchase.cost != null) {
    await upsertPayableForPurchase({
      workspaceId: wsId,
      purchaseId: purchase.id,
      competenceDate: purchase.date,
      value: Number(purchase.cost),
      paid,
    })
  }

  return Response.json({ purchase }, { status: 201 })
}


