import { requireWorkspace } from '@/lib/authz'
import { readExportArtifact } from '@/lib/export-jobs'
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
      status: 'DONE',
    },
    select: {
      fileName: true,
      contentType: true,
      storageKey: true,
      rowCount: true,
      truncated: true,
    },
  })

  if (!job || !job.storageKey || !job.fileName || !job.contentType) {
    return Response.json({ error: 'NOT_READY' }, { status: 404 })
  }

  try {
    const content = await readExportArtifact(job.storageKey)
    const body = new Uint8Array(content)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': job.contentType,
        'Content-Disposition': `attachment; filename="${job.fileName}"`,
        'Cache-Control': 'no-store',
        'X-Export-Truncated': job.truncated ? '1' : '0',
        'X-Export-Row-Count': String(job.rowCount ?? 0),
      },
    })
  } catch {
    return Response.json({ error: 'FILE_NOT_FOUND' }, { status: 404 })
  }
}
