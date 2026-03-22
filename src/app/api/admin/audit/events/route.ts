import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/authz'

const QuerySchema = z.object({
  category: z.enum(['CRUD', 'PERMISSIONS']).optional().default('CRUD'),
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().min(1).optional(),
})

export async function GET(req: Request) {
  const auth = await requireAdmin()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', details: parsed.error.flatten() }, { status: 400 })
  }

  const { category, take, cursor } = parsed.data

  const rows = await prisma.auditEvent.findMany({
    where: { workspaceId: wsId, category },
    orderBy: { createdAt: 'desc' },
    take: take + 1,
    ...(cursor
      ? {
          cursor: { id: cursor },
          skip: 1,
        }
      : {}),
    select: {
      id: true,
      createdAt: true,
      category: true,
      action: true,
      actorUserId: true,
      targetUserId: true,
      entityType: true,
      entityId: true,
      summary: true,
      changes: true,
    },
  })

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

  return Response.json({ items, nextCursor })
}
