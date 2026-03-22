import { z } from 'zod'

import { prisma } from '@/lib/prisma'
import { requireWorkspace } from '@/lib/authz'

const QuerySchema = z.object({
  ids: z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    )
    .refine((arr) => arr.length > 0, 'MISSING_IDS')
    .refine((arr) => arr.length <= 50, 'TOO_MANY_IDS'),
})

export async function GET(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const wsId = auth.user.workspaceId

  const url = new URL(req.url)
  const parsed = QuerySchema.safeParse({ ids: url.searchParams.get('ids') ?? '' })
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_QUERY', details: parsed.error.flatten() }, { status: 400 })
  }

  const ids = parsed.data.ids

  const users = await prisma.user.findMany({
    where: {
      id: { in: ids },
      memberships: { some: { workspaceId: wsId } },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  })

  return Response.json({ users })
}
