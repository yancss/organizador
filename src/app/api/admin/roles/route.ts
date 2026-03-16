import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

export async function GET() {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const roles = await prisma.workspaceRoleModel.findMany({
    where: { workspaceId: wsId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isSystem: true,
      createdAt: true,
      updatedAt: true,
      permissions: { select: { permission: { select: { key: true, module: true, action: true, description: true } } } },
    },
  })

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }, { key: 'asc' }],
    select: { id: true, key: true, module: true, action: true, description: true },
  })

  return Response.json({ roles, permissions })
}

const CreateSchema = z.object({
  name: z.string().min(2).max(60),
  description: z.string().max(200).optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const role = await prisma.workspaceRoleModel.create({
    data: {
      workspaceId: wsId,
      name: parsed.data.name.trim(),
      description: parsed.data.description?.trim() ?? null,
      isSystem: false,
      createdById: auth.user.id,
      updatedById: auth.user.id,
    },
    select: { id: true, name: true },
  })

  return Response.json({ role }, { status: 201 })
}
