import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const items = await prisma.inventory.findMany({
    // Estoque: inclui matéria-prima + intermediários + produto final
    where: { workspaceId: wsId, product: { active: true } },
    orderBy: [{ product: { name: 'asc' } }],
    select: {
      id: true,
      quantity: true,
      minimum: true,
      product: { select: { id: true, name: true, unit: true, kind: true, avgCost: true } },
      updatedAt: true,
    },
  })

  return Response.json({ items })
}

