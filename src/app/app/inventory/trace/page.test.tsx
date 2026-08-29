import React from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen, waitFor } from '@testing-library/react'

import InventoryTracePage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('InventoryTracePage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/products')) {
          return jsonResponse({
            products: [{ id: 'p1', name: 'Acucar', unit: 'kg' }],
          })
        }
        if (url.startsWith('/api/inventory/trace')) {
          return jsonResponse({
            events: [
              {
                id: 'evt-1',
                productId: 'p1',
                eventType: 'PURCHASE_RECEIPT',
                quantity: 5,
                referenceType: 'PurchaseOrder',
                referenceId: 'po-12345678',
                createdAt: '2026-06-15T10:00:00.000Z',
                productName: 'Acucar',
                productUnit: 'kg',
                warehouseName: 'Principal',
                lotCode: 'LOT-01',
                serialCodes: [],
                notes: 'Entrada original',
              },
            ],
            movements: [],
          })
        }
        return jsonResponse({}, { status: 404 })
      }),
    )
  })

  it('renders trace events and applies filters through the request', async () => {
    const user = userEvent.setup()
    renderWithProviders(<InventoryTracePage />)

    expect(await screen.findByRole('heading', { name: /rastreabilidade|traceability|trazabilidad/i })).toBeInTheDocument()
    expect((await screen.findAllByText('Acucar')).length).toBeGreaterThan(0)
    expect(await screen.findByText(/Entrada original/i)).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText(/produto|product|producto/i), 'p1')
    await user.type(screen.getByLabelText(/codigo do lote|lot code|codigo del lote/i), 'LOT-01')

    await waitFor(() => {
      const calls = (global.fetch as any).mock.calls.map((entry: any[]) => String(entry[0]))
      expect(calls.some((url: string) => url.includes('/api/inventory/trace?') && url.includes('productId=p1') && url.includes('lotCode=LOT-01'))).toBe(true)
    })
  })
})
