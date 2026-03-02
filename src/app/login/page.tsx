import { getServerSession } from 'next-auth'
import Link from 'next/link'

import { authOptions } from '@/lib/auth'

import LoginForm from './ui/login-form'

export default async function LoginPage() {
  const session = await getServerSession(authOptions)
  if (session) {
    return (
      <div className="mx-auto max-w-md px-6 py-16">
        <h1 className="text-xl font-semibold">Você já está logado</h1>
        <p className="mt-2 text-sm text-neutral-700">Ir para o app.</p>
        <Link className="mt-4 inline-flex rounded-md bg-black px-4 py-2 text-white" href="/app">
          Abrir Guardian
        </Link>
      </div>
    )
  }

  return (
    <main className="mx-auto grid max-w-md gap-6 px-6 py-16">
      <header>
        <h1 className="font-brand text-2xl font-semibold tracking-tight">Guardian</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Entre com Google ou com email e senha.</p>
      </header>

      <section className="surface rounded-xl border border-theme p-4">
        <div className="grid gap-3">
          <a
            className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            href="/api/auth/signin/google?callbackUrl=/app"
          >
            Entrar com Google
          </a>

          <div className="flex items-center gap-3 py-1">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <div className="text-xs text-[var(--muted-foreground)]">ou</div>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <LoginForm />
        </div>
      </section>

      <p className="text-xs text-[var(--muted-foreground)]">
        Não tem conta? <Link className="underline" href="/register">Criar usuário</Link>
      </p>
    </main>
  )
}
