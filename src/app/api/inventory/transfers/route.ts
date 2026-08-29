import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { normalizeUnit, isConvertible, convertQty } from '@/lib/unit-conversion'
import { transferInventoryBetweenWarehouses } from '@/lib/stock-locations'

const TransferSchema = z.object({
  productId: z.string().min(1),
  fromWarehouseId: z.string().min(1),
  toWarehouseId: z.string().min(1),
  sourceLotId: z.string().optional().nullable(),
  quantity: z.coerce.number().positive(),
  unit: z.string().optional().nullable(),
  observations: z.string().max(2000).optional().nullable(),
})

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const productId = (url.searchParams.get('productId') ?? '').trim()

  const where = {
    workspaceId: wsId,
    ...(productId ? { productId } : {}),
  }

  const transfers = await prisma.inventoryTransfer.findMany({
    where,
    orderBy: [{ createdAt: 'desc' }],
    take: 20,
    select: {
      id: true,
      quantity: true,
      observations: true,
      createdAt: true,
      product: { select: { id: true, name: true, unit: true } },
      fromWarehouse: { select: { id: true, name: true } },
      toWarehouse: { select: { id: true, name: true } },
    },
  })

  return Response.json({ transfers })
}

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const body = await req.json().catch(() => null)
  const parsed = TransferSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })

  const product = await prisma.product.findFirst({
    where: { id: parsed.data.productId, workspaceId: wsId, active: true },
    select: { id: true, unit: true },
  })
  if (!product) return Response.json({ error: 'INVALID_PRODUCT' }, { status: 400 })

  const baseUnit = normalizeUnit(product.unit)
  if (!baseUnit) return Response.json({ error: 'INVALID_PRODUCT_UNIT' }, { status: 400 })
  const inputUnit = parsed.data.unit ? normalizeUnit(parsed.data.unit) : baseUnit
  if (!inputUnit) return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: { from: parsed.data.unit, to: baseUnit } }, { status: 400 })
  if (!isConvertible(inputUnit, baseUnit)) {
    return Response.json({ error: 'INVALID_UNIT_CONVERSION', details: { from: inputUnit, to: baseUnit } }, { status: 400 })
  }

  const quantityBase = convertQty(parsed.data.quantity, inputUnit, baseUnit)

  let transfer
  try {
    transfer = await prisma.$transaction(async (tx) => {
      return transferInventoryBetweenWarehouses(tx as any, {
        workspaceId: wsId,
        productId: parsed.data.productId,
        fromWarehouseId: parsed.data.fromWarehouseId,
        toWarehouseId: parsed.data.toWarehouseId,
        sourceLotId: parsed.data.sourceLotId ?? null,
        quantity: quantityBase,
        observations: parsed.data.observations?.trim() ? parsed.data.observations.trim() : null,
        userId: auth.user.id,
      })
    })
  } catch (err: any) {
    const msg = String(err?.message ?? err)
    if (msg.includes('SERIALIZED_LOT_PARTIAL_CONSUMPTION_UNSUPPORTED')) {
      return Response.json({ error: 'SERIALIZED_LOT_PARTIAL_CONSUMPTION_UNSUPPORTED' }, { status: 409 })
    }
    if (msg.includes('INSUFFICIENT_SOURCE_STOCK')) return Response.json({ error: 'INSUFFICIENT_SOURCE_STOCK' }, { status: 409 })
    if (msg.includes('INVALID_WAREHOUSE')) return Response.json({ error: 'INVALID_WAREHOUSE' }, { status: 400 })
    throw err
  }

  return Response.json({ transfer }, { status: 201 })
}
