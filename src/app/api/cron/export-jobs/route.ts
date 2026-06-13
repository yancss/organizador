import { cleanupExpiredExportJobs, processExportJobs } from '@/lib/export-jobs'

function unauthorized() {
  return Response.json({ error: 'UNAUTHORIZED' }, { status: 401 })
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization') || ''
    if (auth !== `Bearer ${secret}`) return unauthorized()
  } else if (process.env.NODE_ENV === 'production') {
    return Response.json({ error: 'CRON_SECRET_NOT_SET' }, { status: 500 })
  }

  try {
    const [processed, cleaned] = await Promise.all([processExportJobs(), cleanupExpiredExportJobs()])
    return Response.json({ ok: true, processed, cleaned })
  } catch (err) {
    return Response.json(
      {
        error: 'EXPORT_JOBS_PROCESSING_FAILED',
        detail: String((err as any)?.message ?? err ?? 'UNKNOWN_ERROR'),
      },
      { status: 500 },
    )
  }
}
