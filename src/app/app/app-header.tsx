'use client'

import Link from 'next/link'
import { Bebas_Neue, Montserrat_Alternates, Rajdhani } from 'next/font/google'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useEffect, useState } from 'react'

import { useSettings } from './settings-context'

// Quick font switch for the brand name (test options)
const BRAND_FONT: 'bebas' | 'montserrat' | 'rajdhani' = 'montserrat'

// next/font requires each loader call to be assigned to a top-level const
const bebasFont = Bebas_Neue({ subsets: ['latin'], weight: ['400'] })
const montserratFont = Montserrat_Alternates({ subsets: ['latin'], weight: ['700'] })
const rajdhaniFont = Rajdhani({ subsets: ['latin'], weight: ['700'] })

const brandFonts = {
  bebas: bebasFont,
  montserrat: montserratFont,
  rajdhani: rajdhaniFont,
} as const

const brandFont = brandFonts[BRAND_FONT]

import AppNav from './app-nav'
import AvatarMenu from './ui/avatar-menu'

export default function AppHeader() {
  const [open, setOpen] = useState(false)
  const { theme, setTheme, language } = useSettings()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    if (open) window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className="sticky top-0 z-10 border-b border-theme surface">
      <div className="flex w-full items-center gap-3 px-4 py-4 sm:px-6">
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
            href="/app"
            className={
              brandFont.className +
              ' select-none text-xl sm:text-2xl font-bold tracking-[0.06em] leading-[0.92] ' +
              'drop-shadow-[0_10px_30px_rgba(0,0,0,0.25)]'
            }
            aria-label="Guardian"
            title="Guardian"
          >
            <span className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-cyan-300 to-violet-400 drop-shadow-[0_12px_35px_rgba(34,211,238,0.18)] scale-y-[1.08] origin-center">
              Guardian
            </span>
          </Link>
        </div>

        <nav className="ml-auto flex items-center gap-2">
          <div className="flex items-center gap-1">
            <button
              type="button"
              className={"btn btn-secondary btn-icon " + (theme === 'light' ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]' : '')}
              aria-label={language === 'pt' ? 'Tema claro' : language === 'es' ? 'Tema claro' : 'Light theme'}
              title={language === 'pt' ? 'Tema claro' : language === 'es' ? 'Tema claro' : 'Light theme'}
              onClick={() => setTheme('light')}
            >
              <Sun className="size-4" />
            </button>
            <button
              type="button"
              className={"btn btn-secondary btn-icon " + (theme === 'dark' ? 'ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]' : '')}
              aria-label={language === 'pt' ? 'Tema escuro' : language === 'es' ? 'Tema oscuro' : 'Dark theme'}
              title={language === 'pt' ? 'Tema escuro' : language === 'es' ? 'Tema oscuro' : 'Dark theme'}
              onClick={() => setTheme('dark')}
            >
              <Moon className="size-4" />
            </button>
          </div>
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
              <Link
                href="/"
                className="font-brand text-base font-semibold tracking-tight text-[var(--foreground)]"
                onClick={() => setOpen(false)}
              >
                Guardian
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
