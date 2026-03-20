import React, { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { SettingsProvider } from '@/app/app/settings-context'

export function createTestQueryClient() {
  // TanStack Query v5 removed `logger` from QueryClientConfig typings.
  // For tests, we keep retries off and rely on assertions instead of silencing via config.
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(ui: React.ReactElement) {
  const qc = createTestQueryClient()

  function Wrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={qc}>
        <SettingsProvider>{children}</SettingsProvider>
      </QueryClientProvider>
    )
  }

  return { qc, ...render(ui, { wrapper: Wrapper }) }
}
