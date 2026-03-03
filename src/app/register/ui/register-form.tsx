'use client'

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

export type RegisterFormLabels = {
  name: string
  email: string
  birthDate: string
  password: string
  password2: string
  submit: string
  submitting: string
  passwordMismatch: string
  success: string
}

export default function RegisterForm({
  labels = {
    name: 'Nome',
    email: 'Email',
    birthDate: 'Data de nascimento (opcional)',
    password: 'Senha',
    password2: 'Confirmar senha',
    submit: 'Criar usuário',
    submitting: 'Criando…',
    passwordMismatch: 'As senhas não conferem.',
    success: 'Usuário criado. Você já pode entrar.',
  },
}: {
  labels?: RegisterFormLabels
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(false)

    if (password !== password2) {
      setError(labels.passwordMismatch)
      return
    }

    setLoading(true)
    try {
      await api<{ ok: true }>('/api/users', {
        method: 'POST',
        body: JSON.stringify({ name, email, birthDate: birthDate || null, password }),
      })
      setOk(true)
      setPassword('')
      setPassword2('')
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.name}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.email}</span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          autoComplete="email"
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
          required
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.birthDate}</span>
        <input
          value={birthDate}
          onChange={(e) => setBirthDate(e.target.value)}
          type="date"
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
        />
      </label>

      <label className="grid gap-1">
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.password}</span>
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
        <span className="text-xs font-medium text-[var(--foreground)]">{labels.password2}</span>
        <input
          value={password2}
          onChange={(e) => setPassword2(e.target.value)}
          type="password"
          autoComplete="new-password"
          className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
          required
        />
      </label>

      {ok ? <div className="text-sm text-green-700">{labels.success}</div> : null}
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
