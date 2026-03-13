import { getServerSession } from 'next-auth'
import { z } from 'zod'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { enterWithUser } from '@/lib/request-context'

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
    enterWithUser(u.id)
    return { ok: true, userId: u.id }
  }

  if (!session || !userId) {
    return { ok: false as const, status: 401, error: 'UNAUTHORIZED' }
  }
  enterWithUser(userId)
  return { ok: true as const, userId }
}

async function userWorkspaceId(userId: string) {
  const existing = await prisma.workspaceMember.findFirst({
    where: { userId, role: 'owner' },
    select: { workspaceId: true },
  })
  return existing?.workspaceId ?? null
}

const UpdateInventorySchema = z.object({
  quantity: z.coerce.number().optional(),
  minimum: z.coerce.number().optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ productId: string }> }) {
  const auth = await requireUser()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = await userWorkspaceId(auth.userId)
  if (!wsId) return Response.json({ error: 'NO_WORKSPACE' }, { status: 400 })

  const { productId } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = UpdateInventorySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const inv = await prisma.inventory.findFirst({
    where: { workspaceId: wsId, productId },
    select: { id: true },
  })
  if (!inv) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })

  const updated = await prisma.inventory.update({
    where: { id: inv.id },
    data: {
      ...(parsed.data.quantity !== undefined ? { quantity: parsed.data.quantity } : {}),
      ...(parsed.data.minimum !== undefined ? { minimum: parsed.data.minimum ?? null } : {}),
    },
    select: {
      id: true,
      quantity: true,
      minimum: true,
      product: { select: { id: true, name: true, unit: true } },
      updatedAt: true,
    },
  })

  return Response.json({ item: updated })
}
