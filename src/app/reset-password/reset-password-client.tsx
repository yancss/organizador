'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useMemo, useState } from 'react'

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

export default function ResetPasswordClient() {
  const sp = useSearchParams()
  const email = sp.get('email') ?? ''
  const token = sp.get('token') ?? ''

  const hasParams = useMemo(() => Boolean(email && token), [email, token])

  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)

    if (password !== password2) {
      setError('As senhas não conferem.')
      return
    }

    setLoading(true)
    try {
      await api<{ ok: true }>('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, token, password }),
      })
      setOk(true)
      setPassword('')
      setPassword2('')
    } catch {
      setError('Não foi possível redefinir a senha. O link pode ter expirado.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto grid max-w-md gap-4 px-6 py-16">
      <header>
        <h1 className="font-brand text-2xl font-semibold tracking-tight">Redefinir senha</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Defina uma nova senha para sua conta.</p>
      </header>

      {!hasParams ? (
        <section className="surface rounded-xl border border-theme p-4 text-sm">
          <p className="text-[var(--foreground)]">Link inválido. Volte e solicite um novo.</p>
          <Link className="mt-3 inline-flex underline" href="/forgot-password">
            Solicitar novo link
          </Link>
        </section>
      ) : (
        <section className="surface rounded-xl border border-theme p-4">
          <form className="grid gap-3" onSubmit={onSubmit}>
            <div className="text-xs text-[var(--muted-foreground)]">{email}</div>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Nova senha</span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">Confirmar nova senha</span>
              <input
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                type="password"
                autoComplete="new-password"
                className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
                required
              />
            </label>

            {ok ? <div className="text-sm text-green-700">Senha atualizada. Você já pode entrar.</div> : null}
            {error ? <div className="text-sm text-red-700">{error}</div> : null}

            <button
              type="submit"
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
              disabled={loading || !password.trim() || !password2.trim()}
            >
              {loading ? 'Salvando…' : 'Salvar nova senha'}
            </button>
          </form>
        </section>
      )}

      <div className="flex gap-3">
        <Link className="rounded-md border border-theme px-4 py-2 text-sm hover:bg-[var(--muted)]" href="/login">
          Voltar para login
        </Link>
      </div>
    </main>
  )
}
