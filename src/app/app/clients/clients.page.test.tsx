import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import userEvent from '@testing-library/user-event'
import { screen } from '@testing-library/react'
import ClientsPage from './page'
import { renderWithProviders } from '@/test/test-utils'

function jsonResponse(body: any, init?: { status?: number }) {
  const status = init?.status ?? 200
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('ClientsPage', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: any) => {
        const url = String(input)
        if (url.startsWith('/api/clients')) return jsonResponse({ clients: [] })
        return jsonResponse({}, { status: 404 })
      })
    )
  })

  it('renders and requires name to enable Save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<ClientsPage />)

    expect(await screen.findByRole('heading')).toBeInTheDocument()

    const newBtn = screen.getByRole('button', { name: /novo|new/i })
    await user.click(newBtn)

    const saveBtn = screen.getByRole('button', { name: /salvar|save/i })
    expect(saveBtn).toBeDisabled()

    const nameInput = screen.getByLabelText(/nome|name/i)
    await user.type(nameInput, 'Cliente 1')

    expect(saveBtn).toBeEnabled()
  })
})
