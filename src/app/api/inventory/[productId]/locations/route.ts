import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { ensureDefaultWarehouse } from '@/lib/stock-locations'

export async function GET(_req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { productId } = await ctx.params

  await prisma.$transaction(async (tx) => {
    await ensureDefaultWarehouse(tx as any, wsId, auth.user.id)
  })

  const product = await prisma.product.findFirst({
    where: { id: productId, workspaceId: wsId, active: true },
    select: { id: true, name: true, unit: true },
  })
  if (!product) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const locations = await prisma.warehouse.findMany({
    where: { workspaceId: wsId, active: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      isDefault: true,
      inventoryBalances: {
        where: { productId },
        select: { id: true, quantity: true, updatedAt: true },
      },
    },
  })

  return Response.json({
    product,
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      code: location.code,
      isDefault: location.isDefault,
      quantity: location.inventoryBalances[0]?.quantity ?? 0,
      updatedAt: location.inventoryBalances[0]?.updatedAt ?? null,
    })),
  })
}
