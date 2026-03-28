import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Simple edge-friendly rate limit (best-effort).
// Note: this is in-memory per runtime instance; it is not a distributed limiter.
// It still reduces accidental abuse and basic brute-force in UAT.
const buckets = new Map<string, { n: number; resetAt: number }>()

function getIp(req: NextRequest) {
  // NextRequest.ip exists at runtime in some deployments but is not always typed.
  const anyReq = req as any
  return (
    anyReq?.ip ||
    req.headers.get('x-forwarded-for')?.split(',')?.[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

function hit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const b = buckets.get(key)
  if (!b || now >= b.resetAt) {
    buckets.set(key, { n: 1, resetAt: now + windowMs })
    return { ok: true as const, remaining: limit - 1, resetAt: now + windowMs }
  }

  if (b.n >= limit) return { ok: false as const, remaining: 0, resetAt: b.resetAt }
  b.n += 1
  return { ok: true as const, remaining: Math.max(0, limit - b.n), resetAt: b.resetAt }
}

function rateLimitResponse(resetAt: number) {
  const res = NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
  return res
}

// Protect authenticated app routes + best-effort API rate limiting.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Dev bypass (NEVER outside development)
  if (process.env.DISABLE_AUTH === '1' && process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  // API rate limiting (targeted)
  if (pathname.startsWith('/api/')) {
    const ip = getIp(req)

    // Auth endpoints (brute-force / spam sensitive)
    if (pathname.startsWith('/api/auth/')) {
      // allow nextauth callbacks but still limit overall
      const rl = hit(`auth:${ip}`, 20, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt)
      return NextResponse.next()
    }

    // Barcode lookup (calls external services)
    if (pathname === '/api/barcodes/lookup') {
      const rl = hit(`barcode_lookup:${ip}`, 60, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt)
      return NextResponse.next()
    }

    // Scan endpoints (barcode → add item)
    if (pathname.endsWith('/scan')) {
      const rl = hit(`scan:${ip}`, 40, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt)
      return NextResponse.next()
    }

    return NextResponse.next()
  }

  // Only protect the main app shell
  if (!pathname.startsWith('/app')) return NextResponse.next()

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  const token = await getToken({ req, secret })
  if (!token?.sub) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
}
