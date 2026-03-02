import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
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

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const items = await prisma.inventory.findMany({
    // Estoque é para matéria-prima (RAW)
    where: { workspaceId: wsId, product: { active: true, kind: 'RAW' } },
    orderBy: [{ product: { name: 'asc' } }],
    select: {
      id: true,
      quantity: true,
      minimum: true,
      product: { select: { id: true, name: true, unit: true } },
      updatedAt: true,
    },
  })

  return Response.json({ items })
}
