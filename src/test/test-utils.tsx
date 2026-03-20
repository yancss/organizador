import React, { type PropsWithChildren } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { SettingsProvider } from '@/app/app/settings-context'

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
    logger: {
      log: console.log,
      warn: console.warn,
      // silence react-query errors in test output (assert on UI instead)
      error: () => {},
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
