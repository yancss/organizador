import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const salesOrderId = url.searchParams.get('salesOrderId')

  const receivables = await prisma.receivable.findMany({
    where: {
      workspaceId: wsId,
      salesOrderId: salesOrderId ?? undefined,
    },
    orderBy: [{ issuedAt: 'desc' }, { createdAt: 'desc' }],
    take: 200,
    select: {
      id: true,
      salesOrderId: true,
      deliveryId: true,
      clientId: true,
      status: true,
      issuedAt: true,
      dueAt: true,
      value: true,
      applications: {
        select: {
          id: true,
          value: true,
          appliedAt: true,
          payment: { select: { id: true, method: true, status: true, receivedAt: true } },
        },
        orderBy: { appliedAt: 'asc' },
      },
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ receivables })
}

