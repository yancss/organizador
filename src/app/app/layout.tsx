import type { ReactNode } from 'react'

import AppHeader from './app-header'
import Providers from './providers'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-dvh">
        <AppHeader />
        <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </Providers>
  )
}
