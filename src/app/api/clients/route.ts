import { getServerSession } from 'next-auth'
import { z } from 'zod'

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

  const clients = await prisma.client.findMany({
    where: { workspaceId: wsId },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, phone: true, address: true, observations: true },
  })

  return Response.json({ clients })
}

const CreateClientSchema = z.object({
  name: z.string().min(1).max(140),
  phone: z.string().max(50).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  observations: z.string().max(5000).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await ensureWorkspaceId(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateClientSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const client = await prisma.client.create({
    data: {
      workspaceId: wsId,
      name: parsed.data.name,
      phone: parsed.data.phone ?? null,
      address: parsed.data.address ?? null,
      observations: parsed.data.observations ?? null,
    },
    select: { id: true, name: true, phone: true, address: true, observations: true },
  })

  return Response.json({ client }, { status: 201 })
}
