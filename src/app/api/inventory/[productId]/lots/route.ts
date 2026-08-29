import { requireWorkspace } from '@/lib/authz'
import { listInventoryLots } from '@/lib/inventory-lots'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { productId } = await ctx.params

  const lots = await listInventoryLots(
    prisma,
    {
      workspaceId: auth.user.workspaceId,
      productId,
    },
  )

  return Response.json({
    lots: lots.map((lot) => ({
      id: lot.id,
      lotCode: lot.lotCode,
      expiresAt: lot.expiresAt ? new Date(lot.expiresAt).toISOString() : null,
      serialCodes: lot.serialCodes ?? [],
      quantity: Number(lot.quantity ?? 0),
      receivedAt: new Date(lot.receivedAt).toISOString(),
      notes: lot.notes,
      warehouseId: lot.warehouseId,
      warehouseName: lot.warehouseName,
      warehouseCode: lot.warehouseCode,
      purchaseOrderId: lot.purchaseOrderId,
      supplierId: lot.supplierId,
      supplierName: lot.supplierName,
    })),
  })
}
