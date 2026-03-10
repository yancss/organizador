import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  return { ok: true as const, userId }
}

async function ensureWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  if (existing) return existing.workspaceId

  const ws = await prisma.workspace.create({
    data: {
      name: 'Meu espaço',
      members: { create: { userId, role: 'owner' } },
    },
    select: { id: true },
  })
  return ws.id
}

export async function GET(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const url = new URL(req.url)
  const q = (url.searchParams.get('q') ?? '').trim()

  if (q.length < 2) return Response.json({ orders: [] })

  const orders = await prisma.order.findMany({
    where: {
      workspaceId: wsId,
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { client: { name: { contains: q, mode: 'insensitive' } } },
      ],
    },
    orderBy: [{ deliveryAt: 'desc' }, { orderedAt: 'desc' }],
    take: 25,
    select: {
      id: true,
      name: true,
      deliveryAt: true,
      orderedAt: true,
      client: { select: { id: true, name: true } },
    },
  })

  return Response.json({ orders })
}
