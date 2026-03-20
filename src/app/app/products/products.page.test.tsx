import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import ProductsPage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/products')) return jsonResponse({ products: [] })
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('renders and opens create modal (basic validation)', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ProductsPage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /novo|new/i })
    await user.click(newBtn)

    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeDisabled()

    const nameInput = screen.getByLabelText(/nome|name/i)
    await user.type(nameInput, 'Farinha')

    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeEnabled()
  })
})
