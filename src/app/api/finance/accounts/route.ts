import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const accounts = await prisma.financialAccount.findMany({
    where: { workspaceId: wsId, active: true },
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
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const body = await req.json().catch(() => null)
  const parsed = CreateSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const name = parsed.data.name.trim()
  const kind = (parsed.data.kind ?? 'CASH').trim().toUpperCase()

  const account = await prisma.financialAccount.create({
    data: {
      workspaceId: wsId,
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

