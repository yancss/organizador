import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  const url = new URL(req.url)
  return Response.json({
    ok: true,
    host: req.headers.get('host'),
    origin: req.headers.get('origin'),
    url: url.toString(),
    hasCookieHeader: !!req.headers.get('cookie'),
    session,
  })
}