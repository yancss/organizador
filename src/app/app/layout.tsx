import type { ReactNode } from 'react'

import AppHeader from './app-header'
import AppSidebar from './app-sidebar'
import Providers from './providers'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-dvh">
        {/* Full-width top bar */}
        <AppHeader />

        {/* Content area below header */}
        <div className="flex min-h-0">
          <AppSidebar />
          <main className="min-w-0 flex-1 px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-none">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  )
}
