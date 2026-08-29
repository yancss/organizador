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
        <div className="mx-auto flex min-h-0 max-w-[1680px]">
          <AppSidebar />
          <main className="min-w-0 flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
            <div className="page-shell mx-auto max-w-none rounded-[1.5rem] p-4 sm:p-5 lg:p-6">{children}</div>
          </main>
        </div>
      </div>
    </Providers>
  )
}
