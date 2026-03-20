import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import InventoryPage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('InventoryPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/inventory')) {
          return jsonResponse({
            items: [
              {
                id: 'inv1',
                quantity: 2,
                minimum: 5,
                updatedAt: new Date('2026-03-01T10:00:00Z').toISOString(),
                product: { id: 'p1', name: 'Açúcar', unit: 'kg' },
              },
            ],
          })
        }
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('renders a row and opens edit modal on row click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const rowCell = await screen.findByText('Açúcar')
    await user.click(rowCell)

    expect(await screen.findByRole('heading', { name: /editar/i })).toBeInTheDocument()
    // Product name should appear in the modal title
    expect(screen.getByRole('heading', { name: /açúcar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeInTheDocument()
  })
})
