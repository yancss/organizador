'use client'

import { signIn } from 'next-auth/react'
import { useState } from 'react'

export type LoginFormLabels = {
  email: string
  password: string
  submit: string
  submitting: string
  invalid: string
}

export default function LoginForm({
  labels = {
    email: 'Email',
    password: 'Senha',
    submit: 'Entrar',
    submitting: 'Entrando…',
    invalid: 'Email ou senha inválidos.',
  },
}: {
  labels?: LoginFormLabels
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: '/app',
    })

    setLoading(false)

    if (!res || res.error) {
      setError(labels.invalid)
      return
    }

    window.location.href = res.url || '/app'
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.email}</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.password}</span>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
        />
      </label>

      {error ? <div className="text-sm text-red-700">{error}</div> : null}

      <button
        type="submit"
        className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
        disabled={loading || !email.trim() || !password.trim()}
      >
        {loading ? labels.submitting : labels.submit}
      </button>
    </form>
  )
}
