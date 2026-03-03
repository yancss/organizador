'use client'

import Link from 'next/link'
import { useState } from 'react'

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) throw new Error(await res.text())
  return (await res.json()) as T
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSent(false)
    setLoading(true)
    try {
      await api<{ ok: true }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      setSent(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-md gap-4 px-6 py-16">
      <header>
        <h1 className="font-brand text-2xl font-semibold tracking-tight">Recuperar senha</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          Informe seu email. Se existir uma conta, enviaremos um link de redefinição.
        </p>
      </header>

      <section className="surface rounded-xl border border-theme p-4">
        <form className="grid gap-3" onSubmit={onSubmit}>
          <label className="grid gap-1">
            <span className="text-xs font-medium text-[var(--foreground)]">Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
              required
            />
          </label>

          {sent ? (
            <div className="text-sm text-[var(--foreground)]">
              Se o email existir, você receberá um link em instantes.
            </div>
          ) : null}

          <button
            type="submit"
            className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            disabled={loading || !email.trim()}
          >
            {loading ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
      </section>

      <div className="flex gap-3">
        <Link
          className="rounded-md border border-theme px-4 py-2 text-sm hover:bg-[var(--muted)]"
          href="/login"
        >
          Voltar para login
        </Link>
      </div>
    </main>
  )
}
