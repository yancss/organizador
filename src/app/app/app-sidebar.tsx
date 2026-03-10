'use client'

import AppNav from './app-nav'

export default function AppSidebar() {
  return (
    <aside className="surface hidden w-64 shrink-0 border-r border-theme lg:block">
      <div className="flex h-full min-h-[calc(100dvh-72px)] flex-col px-3 py-4">
        <AppNav />

        <div className="mt-auto px-2 pt-4 text-[11px] text-[var(--muted-foreground)]">v0.1</div>
      </div>
    </aside>
  )
}
