'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LogOut, Settings, User } from 'lucide-react'

import { useSettings } from '../settings-context'

export default function AvatarMenu() {
  const { language } = useSettings()
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

  const profileLabel = language === 'pt' ? 'Perfil' : language === 'es' ? 'Perfil' : 'Profile'
  const settingsLabel = language === 'pt' ? 'Configurações' : language === 'es' ? 'Configuración' : 'Settings'
  const logoutLabel = language === 'pt' ? 'Sair' : language === 'es' ? 'Salir' : 'Logout'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid size-10 place-items-center rounded-full border border-theme bg-[var(--surface)] text-sm font-semibold text-[var(--foreground)] hover:bg-[var(--muted)]"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={profileLabel}
        title={profileLabel}
      >
        <span>G</span>
      </button>

      {open ? (
        <div
          className="surface absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-theme shadow-[0_10px_30px_rgba(0,0,0,0.18)]"
          role="menu"
        >
          <Link
            href="/app/profile"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <User className="size-4" />
            {profileLabel}
          </Link>
          <Link
            href="/app/settings"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--foreground)] hover:bg-[var(--muted)]"
            role="menuitem"
            onClick={() => setOpen(false)}
          >
            <Settings className="size-4" />
            {settingsLabel}
          </Link>
          <Link
            href="/api/auth/signout"
            className="flex items-center gap-3 px-4 py-3 text-sm text-[var(--danger)] hover:bg-[var(--danger-bg)]"
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
