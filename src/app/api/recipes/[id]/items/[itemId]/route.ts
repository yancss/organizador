import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

async function requireUser() {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    // pick first user in DB (or create a default)
    let u = await prisma.user.findFirst({ select: { id: true } })
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: 'dev@guardian.local',
          name: 'Dev',
          active: true,
          role: 'owner',
        },
        select: { id: true },
      })
    }
    return { ok: true, userId: u.id }
  }

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
  return { ok: true as const, userId }
}

async function userWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  return existing?.workspaceId ?? null
}

const UpdateItemSchema = z.object({
  quantity: z.coerce.number().positive().optional(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id: recipeId, itemId } = await ctx.params

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, workspaceId: wsId },
    select: { id: true },
  })
  if (!recipe) return Response.json({ error: 'RECIPE_NOT_FOUND' }, { status: 404 })

  const body = await req.json().catch(() => null)
  const parsed = UpdateItemSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const updated = await prisma.recipeItem.updateMany({
    where: { id: itemId, recipeId },
    data: {
      ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
    },
  })

  if (updated.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const item = await prisma.recipeItem.findFirst({
    where: { id: itemId, recipeId },
    select: {
      id: true,
      quantity: true,
      product: { select: { id: true, name: true, unit: true, kind: true } },
      createdAt: true,
    },
  })

  return Response.json({ item })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string; itemId: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { id: recipeId, itemId } = await ctx.params

  const recipe = await prisma.recipe.findFirst({
    where: { id: recipeId, workspaceId: wsId },
    select: { id: true },
  })
  if (!recipe) return Response.json({ error: 'RECIPE_NOT_FOUND' }, { status: 404 })

  const deleted = await prisma.recipeItem.deleteMany({
    where: { id: itemId, recipeId },
  })

  if (deleted.count === 0) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  return Response.json({ ok: true })
}
