import { Suspense } from 'react'

import ActivateClient from './activate-client'

export default function ActivatePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto grid max-w-md gap-4 px-6 py-16">
          <div className="surface rounded-xl border border-theme p-4 text-sm text-[var(--muted-foreground)]">
            Carregando…
          </div>
        </main>
      }
    >
      <ActivateClient />
    </Suspense>
  )
}
