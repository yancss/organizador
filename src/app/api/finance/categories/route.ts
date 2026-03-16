import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  const url = new URL(req.url)
  const type = url.searchParams.get('type')

  const categories = await prisma.financialCategory.findMany({
    where: {
      workspaceId: wsId,
      active: true,
      ...(type === 'IN' || type === 'OUT' ? { type } : {}),
    },
    orderBy: [{ name: 'asc' }],
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

  return Response.json({ categories })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(140),
  type: z.enum(['IN', 'OUT']),
  parentId: z.string().optional().nullable(),
})

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const category = await prisma.financialCategory.create({
    data: {
      workspaceId: wsId,
      name: parsed.data.name.trim(),
      type: parsed.data.type,
      parentId: parsed.data.parentId ?? null,
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

  return Response.json({ category }, { status: 201 })
}

