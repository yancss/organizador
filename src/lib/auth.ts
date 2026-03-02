import type { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@next-auth/prisma-adapter'
import { z } from 'zod'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  debug: process.env.NODE_ENV === 'development',
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

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
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  secret: process.env.NEXTAUTH_SECRET,
  callbacks: {
    jwt: async ({ token, user }) => {
      // When signing in, persist user id into the token.
      if (user?.id) token.sub = user.id
      return token
    },
    session: async ({ session, token }) => {
      // Ensure we always have user.id available on the server (JWT strategy)
      if (session.user) {
        ;(session.user as { id?: string }).id = token.sub
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
