import { z } from 'zod'

import { ENTITY_TYPE_MODULE } from '@/lib/access-control'
import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'
import { hasPermission } from '@/lib/permissions'

const QuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().min(1).optional(),

  entityType: z.string().min(1),
  entityId: z.string().min(1),

  field: z.string().min(1).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
})

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse(Object.fromEntries(url.searchParams.entries()))
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', details: parsed.error.flatten() }, { status: 400 })
  }

  const { take, cursor, entityType, entityId, field, from, to } = parsed.data

  const requiredModule = ENTITY_TYPE_MODULE[entityType]
  if (requiredModule && !hasPermission(auth.user, `${requiredModule}.view`)) {
    return Response.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const where: any = { workspaceId: wsId, category: 'CRUD', entityType, entityId }
  if (from || to) {
    where.createdAt = {}
    if (from) where.createdAt.gte = new Date(from)
    if (to) where.createdAt.lte = new Date(to)
  }
  if (field) where.changes = { some: { field } }

  // Always hide technical summaries for non-admin endpoint
  where.NOT = [{ summary: { startsWith: 'UPDATE_MANY ' } }, { summary: { startsWith: 'CREATE_MANY ' } }, { summary: { startsWith: 'DELETE_MANY ' } }, { summary: { startsWith: 'UPSERT ' } }]

  const rows = await prisma.auditEvent.findMany({
    where,
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
      action: true,
      actorUserId: true,
      entityType: true,
      entityId: true,
      summary: true,
      changes: { select: { field: true, from: true, to: true } },
    },
  })

  const hasMore = rows.length > take
  const items = hasMore ? rows.slice(0, take) : rows
  const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null

  return Response.json({ items, nextCursor })
}
