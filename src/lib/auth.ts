import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    CredentialsProvider({
      name: 'Email e senha',
      credentials: {
        email: { label: 'Email', type: 'email', placeholder: 'seu@email.com' },
        password: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(1),
          })
          .safeParse(credentials)

        if (!parsed.success) return null

        const email = parsed.data.email.trim().toLowerCase()
        const password = parsed.data.password

        const user = await prisma.user.findUnique({
          where: { email },
          select: { id: true, email: true, name: true, passwordHash: true, active: true },
        })

        if (!user || user.active === false) return null
        if (!user.passwordHash) return null

        const ok = await bcrypt.compare(password, user.passwordHash)
        if (!ok) return null

        return { id: user.id, email: user.email ?? email, name: user.name ?? '' }
      },
    }),
  ],
  // For LAN/dev testing: JWT sessions avoid DB session table issues and cookie/host mismatch headaches.
  // Default: 4h fixed sessions (no sliding). Can be overridden per-user.
  session: { strategy: 'jwt', maxAge: 60 * 60 * 4 },
  jwt: { maxAge: 60 * 60 * 4 },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt: async ({ token, user }) => {
      const t = token as any

      // When signing in, persist user id into the token.
      if (user?.id) t.sub = user.id

      // Fixed (non-sliding) expiry enforced by custom claims.
      // NextAuth may re-issue JWTs; we keep a fixed issuedAt/expiresAt and validate against it.
      const DEFAULT_MAX_AGE_SEC = 60 * 60 * 4

      if (t.sub) {
        const dbUser = await prisma.user.findUnique({
          where: { id: t.sub },
          select: {
            id: true,
            role: true,
            active: true,
            sessionMaxAgeSec: true,
            sessionPolicyVersion: true,
          },
        })

        // If user was deactivated after token issuance, force sign-out by dropping sub.
        if (!dbUser || dbUser.active === false) {
          delete t.sub
          t.userRole = undefined
          t.workspaceId = undefined
          t.workspaceRole = undefined
          t.isSuperadmin = undefined
          t.fixedIat = undefined
          t.fixedExp = undefined
          t.policyVersion = undefined
          return token
        }

        // Policy version check (admin can bump to force logout)
        if (t.policyVersion !== undefined && t.policyVersion !== dbUser.sessionPolicyVersion) {
          delete t.sub
          t.userRole = undefined
          t.workspaceId = undefined
          t.workspaceRole = undefined
          t.isSuperadmin = undefined
          t.fixedIat = undefined
          t.fixedExp = undefined
          t.policyVersion = undefined
          return token
        }

        // Establish fixed window on first issuance
        const maxAgeSec = dbUser.sessionMaxAgeSec ?? DEFAULT_MAX_AGE_SEC
        const nowSec = Math.floor(Date.now() / 1000)

        if (!t.fixedIat || !t.fixedExp) {
          t.fixedIat = nowSec
          t.fixedExp = nowSec + maxAgeSec
          t.policyVersion = dbUser.sessionPolicyVersion
        }

        // Hard expiration
        if (nowSec >= Number(t.fixedExp)) {
          delete t.sub
          t.userRole = undefined
          t.workspaceId = undefined
          t.workspaceRole = undefined
          t.isSuperadmin = undefined
          return token
        }

        const userRole = dbUser.role
        t.userRole = userRole
        t.isSuperadmin = userRole === 'SUPERADMIN'

        // Resolve active workspace (first membership). If none, do NOT create anything implicitly.
        const membership = await prisma.workspaceMember.findFirst({
          where: { userId: dbUser.id },
          orderBy: { createdAt: 'asc' },
          select: { workspaceId: true, role: true },
        })

        t.workspaceId = membership?.workspaceId
        t.workspaceRole = membership?.role
      }

      return token
    },
    session: async ({ session, token }) => {
      // Ensure we always have user.id available on the server (JWT strategy)
      if (session.user) {
        const t = token as any
        ;(session.user as any).id = t.sub
        ;(session.user as any).role = t.userRole
        ;(session.user as any).workspaceId = t.workspaceId
        ;(session.user as any).workspaceRole = t.workspaceRole
        ;(session.user as any).isSuperadmin = t.isSuperadmin
        ;(session.user as any).sessionExpiresAt = t.fixedExp ? new Date(Number(t.fixedExp) * 1000).toISOString() : undefined
      }
      return session
    },
    redirect: async ({ url, baseUrl }) => {
      // After login, go straight to the app by default.
      // Guard against misconfigured NEXTAUTH_URL (e.g., "null" or empty) in LAN testing.
      const safeBase = baseUrl && baseUrl !== 'null' ? baseUrl : ''

      if (url === safeBase || url === `${safeBase}/`) return `${safeBase}/app` || '/app'
      if (safeBase && url.startsWith(safeBase)) return url
      if (url.startsWith('/')) return `${safeBase}${url}` || url
      return safeBase || url
    },
  },
}
