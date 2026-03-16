import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const PatchSchema = z.object({
  name: z.string().min(1).max(140).optional(),
  kind: z.string().min(1).max(40).optional(),
  active: z.boolean().optional(),
  openingBalance: z.coerce.number().optional().nullable(),
})

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  const parsed = PatchSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const account = await prisma.financialAccount.update({
    where: { id, workspaceId: wsId },
    data: {
      ...(parsed.data.name != null ? { name: parsed.data.name.trim() } : {}),
      ...(parsed.data.kind != null ? { kind: parsed.data.kind.trim().toUpperCase() } : {}),
      ...(parsed.data.active != null ? { active: parsed.data.active } : {}),
      ...(Object.prototype.hasOwnProperty.call(parsed.data, 'openingBalance')
        ? { openingBalance: parsed.data.openingBalance ?? null }
        : {}),
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

  return Response.json({ account })
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const { id } = await ctx.params

  // soft-delete (keep history)
  await prisma.financialAccount.update({
    where: { id, workspaceId: wsId },
    data: { active: false },
  })

  return Response.json({ ok: true })
}


