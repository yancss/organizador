'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { t } from '../i18n'
import { useSettings } from '../settings-context'
import { api } from '../api-client'

// (moved to api-client.ts)


type User = {
  id: string
  name: string | null
  email: string | null
  birthDate: string | null
}

function toDateInputValue(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function ProfileClient() {
  const { language } = useSettings()
  const i = t(language)

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ ok: true; user: User | null }>('/api/me'),
  })

  const user = meQ.data?.user

  const [name, setName] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [saved, setSaved] = useState(false)
  const [resetSent, setResetSent] = useState(false)

  // sync initial form values
  useMemo(() => {
    if (!user) return
    setName(user.name ?? '')
    setBirthDate(toDateInputValue(user.birthDate))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const saveM = useMutation({
    mutationFn: (payload: { name?: string; birthDate?: string | null }) =>
      api<{ ok: true; user: User }>('/api/me', { method: 'PATCH', body: JSON.stringify(payload) }),
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  const resetM = useMutation({
    mutationFn: (email: string) =>
      api<{ ok: true }>('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
    onSuccess: () => {
      setResetSent(true)
      setTimeout(() => setResetSent(false), 3000)
    },
  })

  async function onSave() {
    setSaved(false)
    const payload: any = {
      name: name.trim(),
      birthDate: birthDate.trim() ? birthDate : null,
    }
    await saveM.mutateAsync(payload)
  }

  async function onResetPassword() {
    if (!user?.email) return
    await resetM.mutateAsync(user.email)
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">{i.profile.title}</h1>
        <p className="text-sm text-[var(--muted-foreground)]">{i.profile.subtitle}</p>
      </header>

      {meQ.isLoading ? (
        <p className="text-sm text-[var(--muted-foreground)]">{i.profile.loading}</p>
      ) : meQ.isError ? (
        <div className="rounded-lg border border-[var(--danger)] bg-[var(--danger-bg)] p-4 text-sm text-[var(--danger)]">
          {i.profile.error}: {String(meQ.error)}
        </div>
      ) : !user ? (
        <div className="surface rounded-xl border border-theme p-4 text-sm text-[var(--muted-foreground)]">
          {i.profile.noUser}
        </div>
      ) : (
        <section className="surface rounded-xl border border-theme p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{i.profile.name}</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{i.profile.email}</span>
              <input
                value={user.email ?? ''}
                disabled
                className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm opacity-70"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-medium text-[var(--foreground)]">{i.profile.birthDate}</span>
              <input
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                type="date"
                className="w-full rounded-md border border-theme bg-transparent px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saveM.isPending}
              className="rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-medium text-[var(--primary-foreground)] disabled:opacity-50"
            >
              {saveM.isPending ? i.profile.saving : i.profile.save}
            </button>

            <button
              type="button"
              onClick={onResetPassword}
              disabled={resetM.isPending || !user.email}
              className="btn btn-secondary"
            >
              {resetM.isPending ? i.profile.sendingReset : i.profile.resetPassword}
            </button>

            {saved ? <span className="text-sm text-green-700">{i.profile.saved}</span> : null}
            {resetSent ? <span className="text-sm text-green-700">{i.profile.resetSent}</span> : null}
          </div>
        </section>
      )}
    </div>
  )
}
