'use client'

import Link from 'next/link'
import { LogOut, Settings } from 'lucide-react'

import { t } from './i18n'
import { useSettings } from './settings-context'

export default function AppHeader() {
  const { language } = useSettings()
  const i = t(language)

  return (
    <header className="sticky top-0 z-10 border-b border-theme surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-brand text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Guardian
        </Link>

        <nav className="flex items-center gap-2 text-sm text-[var(--muted-foreground)]">
          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/app/settings"
            aria-label={language === 'pt' ? 'Perfil' : language === 'es' ? 'Perfil' : 'Profile'}
            title={language === 'pt' ? 'Perfil' : language === 'es' ? 'Perfil' : 'Profile'}
          >
            <Settings className="size-5" />
          </Link>
          <Link
            className="grid size-10 place-items-center rounded-lg hover:bg-[var(--muted)]"
            href="/api/auth/signout"
            aria-label={i.nav.signOut}
            title={i.nav.signOut}
          >
            <LogOut className="size-5" />
          </Link>
        </nav>
      </div>
    </header>
  )
}
