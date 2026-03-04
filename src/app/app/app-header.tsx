'use client'

import Link from 'next/link'

import AvatarMenu from './ui/avatar-menu'

export default function AppHeader() {
  return (
    <header className="sticky top-0 z-10 border-b border-theme surface/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-brand text-lg font-semibold tracking-tight text-[var(--foreground)]"
        >
          Guardian
        </Link>

        <nav className="flex items-center gap-2">
          <AvatarMenu />
        </nav>
      </div>
    </header>
  )
}
