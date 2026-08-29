'use client'

import AppNav from './app-nav'

export default function AppSidebar() {
  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="flex h-full min-h-[calc(100dvh-72px)] flex-col px-4 py-5">
        <AppNav />
      </div>
    </aside>
  )
}
