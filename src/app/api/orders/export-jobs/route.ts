import { z } from 'zod'

import { requireWorkspace } from '@/lib/authz'
import { enqueueOrdersExportJob, processExportJobs } from '@/lib/export-jobs'
import { prisma } from '@/lib/prisma'

const BodySchema = z.object({
  format: z.enum(['csv', 'pdf']),
  params: z.string().optional().default(''),
  currency: z.string().max(10).optional().nullable(),
})

export async function GET() {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const jobs = await prisma.exportJob.findMany({
    where: {
      workspaceId: auth.user.workspaceId,
      requestedById: auth.user.id,
    },
    orderBy: [{ createdAt: 'desc' }],
    take: 20,
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

  return Response.json({ jobs })
}

export async function POST(req: Request) {
  const auth = await requireWorkspace()
  if (!auth.ok) return Response.json({ error: auth.error }, { status: auth.status })

  const body = await req.json().catch(() => null)
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: 'INVALID_BODY', details: parsed.error.flatten() }, { status: 400 })
  }

  const job = await enqueueOrdersExportJob({
    workspaceId: auth.user.workspaceId!,
    userId: auth.user.id,
    kind: parsed.data.format,
    params: parsed.data.params,
    currency: parsed.data.currency ?? null,
  })

  // Best-effort local trigger. Production durability still comes from cron/worker.
  void processExportJobs().catch((err) => {
    console.error('[orders/export-jobs] processExportJobs failed', err)
  })

  return Response.json({ ok: true, job }, { status: 202 })
}
