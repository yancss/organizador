import type { ReactNode } from 'react'

import AppHeader from './app-header'
import AppSidebar from './app-sidebar'
import Providers from './providers'

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <div className="min-h-dvh lg:flex">
        <AppSidebar />
        <div className="min-w-0 flex-1">
          <AppHeader />
          <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </Providers>
  )
}
