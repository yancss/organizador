import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

import { getRouteAccessRequirement } from '@/lib/access-control'
import { hitRateLimit } from '@/lib/rate-limit'

type AuthToken = {
  sub?: string
  isSuperadmin?: boolean
  workspaceRole?: 'USER' | 'ADMIN'
  permissions?: string[]
}

function hasPermission(token: AuthToken, perm: string) {
  if (token.isSuperadmin) return true
  if (token.workspaceRole === 'ADMIN') return true
  return Array.isArray(token.permissions) && token.permissions.includes(perm)
}

function canAccess(token: AuthToken, pathname: string, method: string) {
  const requirement = getRouteAccessRequirement(pathname)
  if (!requirement) return true
  if (requirement.kind === 'admin') {
    return token.isSuperadmin === true || token.workspaceRole === 'ADMIN'
  }

  const action = pathname.startsWith('/api/') && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) ? 'edit' : 'view'
  return hasPermission(token, `${requirement.module}.${action}`)
}

function forbiddenResponse(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  }

  const url = req.nextUrl.clone()
  url.pathname = '/app'
  url.searchParams.set('forbidden', '1')
  return NextResponse.redirect(url)
}

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

function appendRateLimitHeaders(res: NextResponse, remaining: number, resetAt: number, limit: number, source: string) {
  res.headers.set('X-RateLimit-Limit', String(limit))
  res.headers.set('X-RateLimit-Remaining', String(Math.max(0, remaining)))
  res.headers.set('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)))
  res.headers.set('X-RateLimit-Policy', source)
}

function rateLimitResponse(resetAt: number, limit: number, source: string) {
  const res = NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 })
  res.headers.set('Retry-After', String(Math.max(1, Math.ceil((resetAt - Date.now()) / 1000))))
  appendRateLimitHeaders(res, 0, resetAt, limit, source)
  return res
}

async function runRateLimit(key: string, limit: number, windowMs: number) {
  return hitRateLimit(key, limit, windowMs)
}

// Protect authenticated app routes + API rate limiting.
export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Dev bypass (NEVER outside development)
  if (process.env.DISABLE_AUTH === '1' && process.env.NODE_ENV === 'development') {
    return NextResponse.next()
  }

  if (pathname.startsWith('/api/')) {
    const ip = getIp(req)

    if (pathname.startsWith('/api/auth/')) {
      const rl = await runRateLimit(`auth:${ip}`, 20, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt, rl.limit, rl.source)
      const res = NextResponse.next()
      appendRateLimitHeaders(res, rl.remaining, rl.resetAt, rl.limit, rl.source)
      return res
    }

    if (pathname === '/api/barcodes/lookup') {
      const rl = await runRateLimit(`barcode_lookup:${ip}`, 60, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt, rl.limit, rl.source)
      const res = NextResponse.next()
      appendRateLimitHeaders(res, rl.remaining, rl.resetAt, rl.limit, rl.source)
      return res
    }

    if (pathname.endsWith('/scan')) {
      const rl = await runRateLimit(`scan:${ip}`, 40, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt, rl.limit, rl.source)
      const res = NextResponse.next()
      appendRateLimitHeaders(res, rl.remaining, rl.resetAt, rl.limit, rl.source)
      return res
    }

    if (pathname.startsWith('/api/orders/export/')) {
      const rl = await runRateLimit(`orders_export:${ip}`, 10, 60_000)
      if (!rl.ok) return rateLimitResponse(rl.resetAt, rl.limit, rl.source)
      const res = NextResponse.next()
      appendRateLimitHeaders(res, rl.remaining, rl.resetAt, rl.limit, rl.source)
      return res
    }

    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
    const token = (await getToken({ req, secret })) as AuthToken | null
    const requirement = getRouteAccessRequirement(pathname)
    if (requirement && !token?.sub) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
    }
    if (requirement && !canAccess(token as AuthToken, pathname, req.method)) {
      return forbiddenResponse(req)
    }

    return NextResponse.next()
  }

  if (!pathname.startsWith('/app')) return NextResponse.next()

  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET
  const token = await getToken({ req, secret })
  if (!token?.sub) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  const requirement = getRouteAccessRequirement(pathname)
  if (requirement && !canAccess(token as AuthToken, pathname, req.method)) {
    return forbiddenResponse(req)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*', '/api/:path*'],
}
