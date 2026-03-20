import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import FinancePage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('FinancePage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/finance/accounts')) return jsonResponse({ accounts: [] })
        if (url.startsWith('/api/finance/cost-centers')) return jsonResponse({ costCenters: [] })
        if (url.startsWith('/api/finance/categories')) return jsonResponse({ categories: [] })
        if (url.startsWith('/api/finance/entries')) return jsonResponse({ entries: [] })
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('renders and opens modal for a new entry', async () => {
    const user = userEvent.setup()
    renderWithProviders(<FinancePage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /novo|new/i })
    await user.click(newBtn)

    // With empty draft, Save should be disabled (requires value/account)
    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeDisabled()
  })
})
