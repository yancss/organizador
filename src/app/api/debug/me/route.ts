import { getServerSession } from 'next-auth'

import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)

  // TEMP: bypass auth for local testing
  if (process.env.DISABLE_AUTH === '1') {
    let u = await prisma.user.findFirst({
      select: { id: true, email: true, name: true, birthDate: true, active: true },
    })
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: 'dev@guardian.local',
          name: 'Dev',
          active: true,
          role: 'owner',
        },
        select: { id: true, email: true, name: true, birthDate: true, active: true },
      })
    }

    return Response.json({ ok: true, user: u, session: null })
  }

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
