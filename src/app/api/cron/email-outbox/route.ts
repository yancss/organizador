import { processEmailOutbox } from '@/lib/email'

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
    const result = await processEmailOutbox()
    return Response.json({ ok: true, ...result })
  } catch (err) {
    return Response.json(
      {
        error: 'EMAIL_OUTBOX_PROCESSING_FAILED',
        detail: String((err as any)?.message ?? err ?? 'UNKNOWN_ERROR'),
      },
      { status: 500 },
    )
  }
}
