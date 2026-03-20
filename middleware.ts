import { NextResponse, type NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Protect authenticated app routes.
// NOTE: Client-side fetches can still 401 if a session expires; UI should redirect on 401 too.
export async function middleware(req: NextRequest) {
  // Allow local dev bypass
  if (process.env.DISABLE_AUTH === '1') return NextResponse.next()

  const { pathname } = req.nextUrl

  // Only protect the main app shell
  if (!pathname.startsWith('/app')) return NextResponse.next()

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })
  if (!token?.sub) {
    const url = req.nextUrl.clone()
    url.pathname = '/login'
    url.searchParams.set('next', pathname)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/app/:path*'],
}
