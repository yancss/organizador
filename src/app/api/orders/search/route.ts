import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()

  if (q.length < 2) return Response.json({ orders: [] })

  const orders = await prisma.salesOrder.findMany({
    where: {
      workspaceId: wsId,
      OR: [
        { code: { contains: q, mode: 'insensitive' } },
        { name: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    orderBy: [{ deliveryAt: 'desc' }, { orderedAt: 'desc' }],
    take: 25,
    select: {
      id: true,
      code: true,
      name: true,
      deliveryAt: true,
      orderedAt: true,
      client: { select: { id: true, name: true } },
    },
  })

  return Response.json({ orders })
}

