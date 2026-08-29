'use client'

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Briefcase, CircleUser, LogOut, Settings, Shield, Star, User } from 'lucide-react'

import { api } from '../api-client'
import { t } from '../i18n'
import { useSettings } from '../settings-context'

export default function AvatarMenu() {
  const { language } = useSettings()
  const i = t(language)

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ ok: true; user: { name: string | null; email: string | null; avatarIcon: string | null } | null }>(
      '/api/me',
    ),
    staleTime: 30_000,
  })

  const user = meQ.data?.user

  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return
      if (!ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const profileLabel = i.common.menuProfile
  const settingsLabel = i.common.menuSettings
  const logoutLabel = i.common.menuLogout

  const AvatarIcon = useMemo(() => {
    const key = user?.avatarIcon
    if (key === 'star') return Star
    if (key === 'briefcase') return Briefcase
    if (key === 'shield') return Shield
    if (key === 'user') return CircleUser
    return null
  }, [user?.avatarIcon])

  const fallbackLetter = (user?.name || user?.email || 'G').slice(0, 1).toUpperCase()

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full border border-theme bg-[var(--surface-2)] text-sm font-semibold text-[var(--foreground)] shadow-[var(--shadow-sm)] transition hover:bg-[var(--surface)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={profileLabel}
        title={profileLabel}
      >
        {AvatarIcon ? <AvatarIcon className="size-5" /> : <span>{fallbackLetter}</span>}
      </button>

      {open ? (
        <div
          className="surface absolute right-0 mt-2 w-64 overflow-hidden rounded-2xl border border-theme shadow-[var(--shadow-lg)]"
          role="menu"
        >
          <div className="border-b border-theme bg-[var(--surface-2)] px-4 py-3">
            <div className="truncate text-sm font-semibold text-[var(--foreground)]">{user?.name || 'Guardian user'}</div>
            <div className="truncate text-xs text-[var(--text-muted)]">{user?.email || 'Workspace account'}</div>
          </div>
          <Link
            href="/app/profile"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <User className="size-4" />
            {profileLabel}
          </Link>
          <Link
            href="/app/settings"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] transition hover:bg-[var(--muted)]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" />
            {settingsLabel}
          </Link>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--danger)] transition hover:bg-[var(--danger-bg)]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <LogOut className="size-4" />
            {logoutLabel}
          </Link>
        </div>
      ) : null}
    </div>
  )
}
