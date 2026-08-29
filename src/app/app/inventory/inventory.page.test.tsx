import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
        if (url.startsWith('/api/clients')) {
          return jsonResponse({ clients: [] })
        }
        if (url.startsWith('/api/purchase-orders/replenishment')) {
          return jsonResponse({
            items: [
              {
                id: 'inv2',
                quantity: 8,
                minimum: 5,
                reorderTarget: 12,
                criticality: 'HIGH',
                suggestedQty: 4,
                shortageQty: 0,
                coverageDays: 6,
                daysToMinimum: 2,
                purchaseWindowDays: 8,
                isInPurchaseWindow: true,
                effectiveLeadTimeDays: 5,
                nextOrderInDays: 1,
                nextOrderDate: '2026-03-02',
                expectedArrivalDate: '2026-03-06',
                riskLevel: 'soon',
                riskScore: 2,
                updatedAt: new Date('2026-03-01T10:00:00Z').toISOString(),
                product: { id: 'p2', name: 'Farinha', unit: 'kg', kind: 'RAW' },
              },
            ],
            groups: [],
            meta: { page: 1, take: 25, total: 1, totalPages: 1 },
          })
        }
        if (url.startsWith('/api/inventory')) {
          return jsonResponse({
            items: [
              {
                id: 'inv1',
                quantity: 2,
                minimum: 5,
                criticality: 'MEDIUM',
                updatedAt: new Date('2026-03-01T10:00:00Z').toISOString(),
                product: { id: 'p1', name: 'Açúcar', unit: 'kg' },
              },
            ],
            meta: { page: 1, take: 25, total: 1, totalPages: 1 },
          })
        }
        return jsonResponse({}, { status: 404 })
      }),
    )
  })

  it('renders a row and opens edit modal on row click', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const rowCell = await screen.findByText('Açúcar')
    await user.click(rowCell)

    expect(await screen.findByRole('heading', { name: /editar/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /açúcar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /salvar|save/i })).toBeInTheDocument()
  })

  it('shows coverage and purchase window in replenishment mode', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryPage />)

    await user.click(await screen.findByRole('button', { name: /reposi|replenishment/i }))

    expect(await screen.findByText('Farinha')).toBeInTheDocument()
    expect(await screen.findByText(/6\.0d cobertura|6\.0d coverage/i)).toBeInTheDocument()
    expect(await screen.findByText(/pedido em 1d|order in 1d/i)).toBeInTheDocument()
  })
})
