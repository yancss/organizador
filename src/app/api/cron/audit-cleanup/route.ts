import { prisma } from '@/lib/prisma'
import { getAuditRetentionMonths, retentionMonthsToCutoff } from '@/lib/audit-retention'

function unauthorized() {
  return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
}

export async function GET(req: Request) {
  // Allow running locally without secret.
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) return unauthorized()
  } else {
    // If no secret is set, we still allow it in dev.
    if (process.env.NODE_ENV === 'production') {
      return Response.json({ error: 'CRON_SECRET_NOT_SET' }, { status: 500 })
    }
  }

  const workspaces = await prisma.workspace.findMany({ select: { id: true } })

  const now = new Date()
  const results: Array<{ workspaceId: string; months: number; cutoff: string; deleted: number }> = []

  for (const ws of workspaces) {
    const months = await getAuditRetentionMonths(ws.id)
    const cutoff = retentionMonthsToCutoff(months, now)

    const del = await prisma.auditEvent.deleteMany({
      where: {
        workspaceId: ws.id,
        createdAt: { lt: cutoff },
      },
    })

    results.push({ workspaceId: ws.id, months, cutoff: cutoff.toISOString(), deleted: del.count })
  }

  const totalDeleted = results.reduce((acc, r) => acc + r.deleted, 0)
  return Response.json({ ok: true, totalDeleted, results })
}
