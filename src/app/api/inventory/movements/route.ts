import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

function parsePositiveInt(value: string | null, fallback: number, max: number) {
  const n = Number(value)
  if (!Number.isFinite(n) || n <= 0) return fallback
  return Math.min(max, Math.floor(n))
}

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const productId = (url.searchParams.get('productId') ?? '').trim()
  const take = parsePositiveInt(url.searchParams.get('take'), 20, 100)

  const movements = await prisma.inventoryMovement.findMany({
    where: {
      workspaceId: wsId,
      ...(productId ? { productId } : {}),
    },
    orderBy: [{ createdAt: 'desc' }],
    take,
    select: {
      id: true,
      movementType: true,
      quantity: true,
      unitCost: true,
      referenceType: true,
      referenceId: true,
      observations: true,
      balanceAfterGlobal: true,
      balanceAfterWarehouse: true,
      createdAt: true,
      product: { select: { id: true, name: true, unit: true } },
      warehouse: { select: { id: true, name: true, code: true } },
    },
  })

  return Response.json({ movements })
}
