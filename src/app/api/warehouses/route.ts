import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { ensureDefaultWarehouse } from '@/lib/stock-locations'

const CreateWarehouseSchema = z.object({
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().min(2).max(32).regex(/^[A-Za-z0-9_-]+$/).optional(),
})

function normalizeCode(name: string) {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32)
}

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId
  await prisma.$transaction(async (tx) => {
    await ensureDefaultWarehouse(tx as any, wsId, auth.user.id)
  })

  const warehouses = await prisma.warehouse.findMany({
    where: { workspaceId: wsId, active: true },
    orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      code: true,
      isDefault: true,
      _count: { select: { inventoryBalances: true } },
    },
  })

  return Response.json({ warehouses })
}

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const parsed = CreateWarehouseSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })

  const wsId = auth.user.workspaceId
  const code = (parsed.data.code?.trim() || normalizeCode(parsed.data.name) || 'LOC').slice(0, 32)

  const warehouse = await prisma.warehouse.create({
    data: {
      workspaceId: wsId,
      createdById: auth.user.id,
      updatedById: auth.user.id,
      name: parsed.data.name.trim(),
      code,
      active: true,
      isDefault: false,
    },
    select: {
      id: true,
      name: true,
      code: true,
      isDefault: true,
    },
  })

  return Response.json({ warehouse }, { status: 201 })
}
