import Link from 'next/link'

import RegisterForm from './ui/register-form'

export default function RegisterPage() {
  return (
    <main className="mx-auto grid max-w-md gap-6 px-6 py-16">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Criar usuário</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Crie um usuário com email e senha para entrar no Guardian.
        </p>
      </header>

      <section className="surface rounded-xl border border-theme p-4">
        <RegisterForm />
      </section>

      <p className="text-xs text-[var(--muted-foreground)]">
        Já tem conta? <Link className="underline" href="/login">Entrar</Link>
      </p>
    </main>
  )
}
