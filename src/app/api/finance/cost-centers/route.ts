import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const costCenters = await prisma.costCenter.findMany({
    where: { workspaceId: wsId, active: true },
    orderBy: [{ name: 'asc' }],
    select: { id: true, name: true, active: true, createdAt: true, updatedAt: true },
  })

  return Response.json({ costCenters })
}

const CreateSchema = z.object({
  name: z.string().min(1).max(140),
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

  const costCenter = await prisma.costCenter.create({
    data: { workspaceId: wsId, name: parsed.data.name.trim() },
    select: { id: true, name: true, active: true, createdAt: true, updatedAt: true },
  })

  return Response.json({ costCenter }, { status: 201 })
}

