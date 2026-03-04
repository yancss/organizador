'use client'

import Link from 'next/link'

import AppNav from './app-nav'

export default function AppSidebar() {
  return (
    <aside className="surface/80 hidden w-64 shrink-0 border-r border-theme backdrop-blur lg:block">
      <div className="flex h-dvh flex-col px-3 py-4">
        <div className="px-2 pb-3">
          <Link href="/" className="inline-flex items-center gap-3">
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
        </div>

        <AppNav />

        <div className="mt-auto px-2 pt-4 text-[11px] text-[var(--muted-foreground)]">v0.1</div>
      </div>
    </aside>
  )
}
