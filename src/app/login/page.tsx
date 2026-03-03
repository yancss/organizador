import { getServerSession } from 'next-auth'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'

import LoginClient from './ui/login-client'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-semibold">Você já está logado</h1>
        <p className="mt-2 text-sm text-[var(--text-muted)]">Ir para o app.</p>
        <Link className="mt-4 inline-flex rounded-md bg-black px-4 py-2 text-white" href="/app">
          Abrir Guardian
        </Link>
      </div>
    )
  }

  return <LoginClient />
}
