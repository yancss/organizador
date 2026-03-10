import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  // In local/dev mode, allow bypassing NextAuth entirely.
  // Important: do this BEFORE calling getServerSession to avoid NextAuth misconfig causing 500s.
  if (process.env.DISABLE_AUTH === '1') {
    const u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      const created = await prisma.user.create({
        data: { email: 'dev@guardian.local', name: 'Dev', active: true, role: 'owner' },
        select: { id: true },
      })
      return { ok: true as const, userId: created.id }
    }
    return { ok: true as const, userId: u.id }
  }

  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id

  if (!session || !userId) return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
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

const PatchSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  active: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const ws = await ensureWorkspace(auth.userId)

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const category = await prisma.financialCategory.update({
    where: { id, workspaceId: ws.id },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.active != null ? { active: parsed.data.active } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'parentId')
        ? { parentId: parsed.data.parentId ?? null }
        : {}),
    },
    select: {
      id: true,
      name: true,
      type: true,
      parentId: true,
      active: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return Response.json({ category })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })
  const ws = await ensureWorkspace(auth.userId)

  const { id } = await ctx.params

  await prisma.financialCategory.update({
    where: { id, workspaceId: ws.id },
    data: { active: false },
  })

  return Response.json({ ok: true })
}
