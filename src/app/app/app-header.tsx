'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import AppNav from './app-nav'
import AvatarMenu from './ui/avatar-menu'

export default function AppHeader() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    if (open) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-10 border-b border-theme surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--foreground)] hover:bg-[var(--muted)] lg:hidden"
            aria-label={open ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Link
            href="/"
            className="truncate font-brand text-lg font-semibold tracking-tight text-[var(--foreground)]"
          >
            Guardian
          </Link>
        </div>

        <nav className="flex items-center gap-2">
          <AvatarMenu />
        </nav>
      </div>

      {open ? (
        <div className="lg:hidden">
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Fechar menu"
            onClick={() => setOpen(false)}
          />

          <aside className="surface fixed left-0 top-0 z-50 h-dvh w-[18rem] border-r border-theme p-4">
            <div className="flex items-center justify-between gap-3">
              <Link href="/" className="inline-flex items-center gap-3" onClick={() => setOpen(false)}>
                <div className="grid h-10 w-10 place-items-center rounded-2xl bg-[var(--primary)] text-[var(--primary-foreground)]">
                  <span className="font-brand text-base font-semibold">G</span>
                </div>
                <div>
                  <div className="font-brand text-base font-semibold tracking-tight text-[var(--foreground)]">
                    Guardian
                  </div>
                  <div className="text-xs text-[var(--muted-foreground)]">Organizador</div>
                </div>
              </Link>

              <button
                type="button"
                className="inline-flex size-10 items-center justify-center rounded-xl text-[var(--foreground)] hover:bg-[var(--muted)]"
                aria-label="Fechar menu"
                onClick={() => setOpen(false)}
              >
                <X className="size-5" />
              </button>
            </div>

            <AppNav onNavigate={() => setOpen(false)} />

            <div className="mt-auto pt-6 text-[11px] text-[var(--muted-foreground)]">v0.1</div>
          </aside>
        </div>
      ) : null}
    </header>
  )
}
