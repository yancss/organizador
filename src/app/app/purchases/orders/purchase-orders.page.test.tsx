import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import PurchaseOrdersPage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('PurchaseOrdersPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/purchase-orders')) return jsonResponse({ purchaseOrders: [] })
        if (url.startsWith('/api/products')) return jsonResponse({ products: [] })
        if (url.startsWith('/api/clients')) return jsonResponse({ clients: [] })
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('opens create modal and keeps Save disabled without supplier', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PurchaseOrdersPage />)

    expect(await screen.findByRole('heading', { name: /pedido|purchase/i })).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /novo|new/i })
    await user.click(newBtn)

    const saveBtn = screen.getByRole('button', { name: /salvar|save/i })
    expect(saveBtn).toBeDisabled()
  })
})
