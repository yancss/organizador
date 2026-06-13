import { requireWorkspace } from '@/lib/authz'
import { prisma } from '@/lib/prisma'

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const { id } = await ctx.params
  const job = await prisma.exportJob.findFirst({
    where: {
      id,
      workspaceId: auth.user.workspaceId,
      requestedById: auth.user.id,
    },
    select: {
      id: true,
      kind: true,
      status: true,
      fileName: true,
      rowCount: true,
      truncated: true,
      error: true,
      createdAt: true,
      completedAt: true,
    },
  })

  if (!job) return Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  return Response.json({ job })
}
