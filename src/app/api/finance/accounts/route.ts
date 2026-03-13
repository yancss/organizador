import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

async function requireUser() {
  // In local/dev mode, allow bypassing NextAuth entirely.
  // Important: do this BEFORE calling getServerSession to avoid NextAuth misconfig causing 500s.
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
    }
    enterWithUser(u.id)
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

async function ensureWorkspace(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    include: { workspace: true },
  })
  if (existing) return existing.workspace

  const ws = await prisma.workspace.create({
    data: { name: 'Meu espaço', members: { create: { userId, role: 'owner' } } },
  })
  return ws
}

export async function GET() {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const ws = await ensureWorkspace(auth.userId)

  const accounts = await prisma.financialAccount.findMany({
    where: { workspaceId: ws.id, active: true },
    orderBy: [{ name: 'asc' }],
    select: {
      id: true,
      name: true,
      kind: true,
      active: true,
      openingBalance: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ accounts })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(140),
  kind: z.string().min(1).max(40).optional(),
  openingBalance: z.coerce.number().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const ws = await ensureWorkspace(auth.userId)

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name.trim()
  const kind = (parsed.data.kind ?? 'CASH').trim().toUpperCase()

  const account = await prisma.financialAccount.create({
    data: {
      workspaceId: ws.id,
      name,
      kind,
      openingBalance: parsed.data.openingBalance ?? null,
    },
    select: {
      id: true,
      name: true,
      kind: true,
      active: true,
      openingBalance: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ account }, { status: 201 })
}
